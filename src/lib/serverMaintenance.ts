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
import { isAuthorizedForMonitoring, extractMonitoringToken } from '../config/monitoringAccess';
import { verifyAccessToken } from './serverAuth';

interface MaintenanceState {
  enabled: boolean;
  message: string;
  enabledAt: string | null;
  enabledBy: string | null;
  estimatedDuration: string | null;
}

const STATE_FILE_PATH = path.join(process.cwd(), 'data', 'maintenance_state.json');

let currentState: MaintenanceState = {
  enabled: false,
  message: 'سامانه در حال بروزرسانی و پشتیبان‌گیری دوره‌ای می‌باشد. لطفاً دقایقی دیگر مراجعه فرمایید.',
  enabledAt: null,
  enabledBy: null,
  estimatedDuration: '۱۵ دقیقه'
};

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
      currentState = { ...currentState, ...parsed };
    }
  }
} catch (e) {
  console.warn('[Maintenance State Load Notice]:', e);
}

function persistState(): void {
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(currentState, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Maintenance State Persist Warning]:', e);
  }
}

export function getMaintenanceState(): MaintenanceState {
  return { ...currentState };
}

export function setMaintenanceState(
  enabled: boolean, 
  operator: string, 
  customMessage?: string,
  estimatedDuration?: string
): MaintenanceState {
  currentState.enabled = enabled;
  if (enabled) {
    currentState.enabledAt = new Date().toISOString();
    currentState.enabledBy = operator;
    if (customMessage) currentState.message = customMessage;
    if (estimatedDuration) currentState.estimatedDuration = estimatedDuration;
  } else {
    currentState.enabledAt = null;
    currentState.enabledBy = null;
  }
  persistState();
  return { ...currentState };
}

/**
 * Express Middleware to intercept regular traffic during maintenance mode.
 */
export function maintenanceMiddleware(req: Request, res: Response, next: NextFunction): void {
  // If not enabled, proceed normally
  if (!currentState.enabled) {
    return next();
  }

  const p = req.path || '';

  // Always allow health checks, diagnostics, client static assets, auth routes, and monitoring
  if (
    p === '/health' ||
    p === '/api/healthz' ||
    p === '/api/version' ||
    p.startsWith('/api/monitor') ||
    p.startsWith('/api/auth/login') ||
    p.startsWith('/api/auth/me') ||
    !p.startsWith('/api/') // Static files, frontend bundles
  ) {
    return next();
  }

  // Check if caller has trusted admin role (Super Admin, Education Manager, Finance Manager)
  const token = extractMonitoringToken(req);
  if (token) {
    const verification = verifyAccessToken(token);
    if (verification.valid && verification.decoded && isAuthorizedForMonitoring(verification.decoded)) {
      return next(); // Trusted manager bypasses maintenance mode
    }
  }

  // Otherwise, return 503 Service Unavailable with friendly Persian message
  res.status(503).json({
    success: false,
    maintenance: true,
    message: currentState.message,
    estimatedDuration: currentState.estimatedDuration,
    enabledAt: currentState.enabledAt
  });
}
