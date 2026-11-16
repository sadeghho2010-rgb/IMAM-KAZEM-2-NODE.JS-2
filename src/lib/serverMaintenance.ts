/**
 * Server Maintenance Mode Manager
 * Allows Super Admin, Education Manager, and Finance Manager to toggle maintenance mode.
 * In maintenance mode:
 * - Regular API calls return 503 with a friendly Persian message.
 * - Authorized personnel (Super Admin, Education Manager, Finance Manager) can still access everything.
 * - Static assets, login, /health, /api/auth, and /api/monitor remain reachable.
 */

import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { isAuthorizedForMaintenance, extractMonitoringToken } from '../config/monitoringAccess';
import { verifyAccessToken } from './serverAuth';
import { MysqlRepository, isMysqlConfigured } from './databaseAbstraction';
import { notifyRealtimeChange } from './serverDataApi';

export interface MaintenanceState {
  id?: string;
  enabled: boolean;
  message: string;
  enabledAt: string | null;
  enabledBy: string | null;
  estimatedDuration: string | null;
  version: number;
  updated_at: string;
}

const STATE_FILE_PATH = path.join(process.cwd(), 'data', 'maintenance_state.json');

let currentState: MaintenanceState = {
  id: 'maintenance_mode',
  enabled: false,
  message: 'سامانه در حال بروزرسانی و نگهداری فنی می‌باشد. لطفاً دقایقی دیگر مراجعه فرمایید.',
  enabledAt: null,
  enabledBy: null,
  estimatedDuration: '۱۵ دقیقه',
  version: 1,
  updated_at: new Date().toISOString()
};

let lastDbHydrationAt = 0;

// Ensure data directory exists and load persisted state on boot
try {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (fs.existsSync(STATE_FILE_PATH)) {
    const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.enabled === 'boolean') {
      currentState = {
        ...currentState,
        ...parsed,
        version: Number(parsed.version) || 1,
        updated_at: parsed.updated_at || new Date().toISOString()
      };
    }
  }
} catch (e) {
  console.warn('[Maintenance State Load Notice]:', e);
}

function persistDiskState(): void {
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(currentState, null, 2), 'utf-8');
  } catch (e) {
    console.error('[STORAGE_FAILURE][maintenance_disk_persist]', e);
  }
}

export async function ensureMaintenanceLoadedFromDb(force = false): Promise<MaintenanceState> {
  if (!isMysqlConfigured) return { ...currentState };
  const now = Date.now();
  if (!force && now - lastDbHydrationAt < 2500) {
    return { ...currentState };
  }
  lastDbHydrationAt = now;
  try {
    const doc = await MysqlRepository.getDocument('system_settings', 'maintenance_mode');
    if (doc && typeof doc.enabled === 'boolean') {
      const dbVer = Number(doc.version) || 1;
      const localVer = Number(currentState.version) || 1;
      const dbTime = doc.updated_at ? new Date(doc.updated_at).getTime() : 0;
      const localTime = currentState.updated_at ? new Date(currentState.updated_at).getTime() : 0;
      if (dbVer > localVer || (dbVer === localVer && dbTime > localTime)) {
        currentState = {
          id: 'maintenance_mode',
          enabled: Boolean(doc.enabled),
          message: doc.message || currentState.message,
          enabledAt: doc.enabledAt ?? null,
          enabledBy: doc.enabledBy ?? null,
          estimatedDuration: doc.estimatedDuration ?? '۱۵ دقیقه',
          version: dbVer,
          updated_at: doc.updated_at || new Date().toISOString()
        };
        persistDiskState();
      }
    }
  } catch (err: any) {
    console.error('[STORAGE_FAILURE][maintenance_db_load]', err?.message || err);
  }
  return { ...currentState };
}

export function getMaintenanceState(): MaintenanceState {
  return { ...currentState };
}

export async function setMaintenanceState(
  enabled: boolean,
  operator: string,
  customMessage?: string,
  estimatedDuration?: string
): Promise<MaintenanceState> {
  // Sync latest version from DB first so optimistic version never regresses
  await ensureMaintenanceLoadedFromDb(true);

  const nextVersion = (Number(currentState.version) || 0) + 1;
  const nowIso = new Date().toISOString();

  const nextState: MaintenanceState = {
    id: 'maintenance_mode',
    enabled: Boolean(enabled),
    message: (typeof customMessage === 'string' && customMessage.trim())
      ? customMessage.trim()
      : currentState.message,
    estimatedDuration: (typeof estimatedDuration === 'string' && estimatedDuration.trim())
      ? estimatedDuration.trim()
      : (enabled ? (currentState.estimatedDuration || '۱۵ دقیقه') : currentState.estimatedDuration),
    enabledAt: enabled ? nowIso : null,
    enabledBy: enabled ? operator : null,
    version: nextVersion,
    updated_at: nowIso
  };

  currentState = nextState;
  persistDiskState();

  if (isMysqlConfigured) {
    try {
      await MysqlRepository.saveDocument('system_settings', 'maintenance_mode', nextState);
      console.log('[STORAGE_SUCCESS][system_settings/maintenance_mode]', `v${nextState.version}`, `enabled=${nextState.enabled}`);
    } catch (err: any) {
      console.error('[STORAGE_FAILURE][system_settings/maintenance_mode]', err?.message || err);
    }
  }

  try {
    notifyRealtimeChange('system_settings', 'maintenance_mode', 'upsert');
  } catch (e: any) {
    console.error('[STORAGE_FAILURE][maintenance_notify]', e?.message || e);
  }

  return { ...currentState };
}

/**
 * Express Middleware to intercept regular traffic during maintenance mode.
 */
export function maintenanceMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!currentState.enabled) {
    return next();
  }

  const p = req.path || '';

  // Always allow health checks, maintenance status probe, client static assets, auth endpoints, realtime stream, and monitoring maintenance control
  if (
    p === '/health' ||
    p === '/api/healthz' ||
    p === '/api/version' ||
    p === '/api/system/maintenance-status' ||
    p.startsWith('/api/monitor/maintenance') ||
    p.startsWith('/api/auth/login') ||
    p.startsWith('/api/auth/me') ||
    p.startsWith('/api/auth/logout') ||
    p.startsWith('/api/data/changes') ||
    !p.startsWith('/api/')
  ) {
    return next();
  }

  // Strictly allow ONLY non-read-only Super Admin and Education Officer to bypass maintenance mode
  const token = extractMonitoringToken(req);
  if (token) {
    const verification = verifyAccessToken(token);
    if (verification.valid && verification.decoded && isAuthorizedForMaintenance(verification.decoded)) {
      return next();
    }
  }

  res.status(503).json({
    success: false,
    maintenance: true,
    message: currentState.message,
    estimatedDuration: currentState.estimatedDuration,
    enabledAt: currentState.enabledAt,
    version: currentState.version
  });
}

