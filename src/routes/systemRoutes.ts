import { Router, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/serverAuth';
import { getSystemHealthReport, recordMemorySnapshot } from '../lib/systemHealthMonitor';
import {
  getDbConnectionStatus,
  testMysqlConnection,
  getForceReloadVersion,
  setForceReloadVersion,
  MysqlRepository,
} from '../lib/databaseAbstraction';

const router = Router();

// Helper to extract JWT token from request cookies or Authorization headers
const extractToken = (req: Request): string | null => {
  if (req.cookies && (req.cookies.auth_access_token || req.cookies.auth_token)) {
    return req.cookies.auth_access_token || req.cookies.auth_token;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

/**
 * GET /api/system/health
 * Realtime system health monitoring endpoint.
 * Restricted strictly to super_admin / level 1.
 * Returns RAM usage (current & 24h trend), slow queries (>1000ms), and recent server errors.
 */
router.get('/health', async (req: Request, res: Response) => {
  // Disable caching so results are always live
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'توکن امنیتی معتبر یافت نشد.' });
    }

    const verification = verifyAccessToken(token);
    if (!verification.valid || !verification.decoded) {
      return res.status(401).json({ success: false, message: 'اعتبار جلسه کاربری منقضی شده است.' });
    }

    const user = verification.decoded as any;
    const usernameUpper = (user.username || '').toUpperCase();
    const isSuperAdmin = user.role === 'super_admin' || user.level === 1 || user.role === 'school_manager' || usernameUpper === 'SADEGH';
    const isEducationManager = user.role === 'education_manager' || user.role === 'education_officer' || usernameUpper === 'SHAH' || (user.name && user.name.includes('آموزش'));
    const isFinanceManager = user.role === 'finance_manager' || user.role === 'finance_officer' || usernameUpper === 'MALI' || (user.name && user.name.includes('مالی'));
    const hasExplicitTab = Array.isArray(user.allowedTabs) && user.allowedTabs.includes('system-health');

    const isAuthorized = isSuperAdmin || isEducationManager || isFinanceManager || hasExplicitTab;
    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'دسترسی به پایش سلامت سیستم فقط برای سوپر ادمین، مسئول آموزش و مسئول مالی مجاز است.' });
    }

    // Capture latest memory snapshot before sending report
    await recordMemorySnapshot();

    const report = getSystemHealthReport();
    const forceReloadVersion = await getForceReloadVersion();
    return res.json({
      success: true,
      forceReloadVersion,
      ...report
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطا در دریافت وضعیت سلامت سیستم';
    return res.status(500).json({ success: false, message });
  }
});

/**
 * POST /api/system/force-reload
 * Triggers a manual one-time hard reload version in MySQL system settings.
 * Restricted strictly to super_admin, school_manager, and education_manager.
 */
router.post('/force-reload', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'توکن امنیتی معتبر یافت نشد.' });
    }

    const verification = verifyAccessToken(token);
    if (!verification.valid || !verification.decoded) {
      return res.status(401).json({ success: false, message: 'اعتبار جلسه کاربری منقضی شده است.' });
    }

    const user = verification.decoded as any;
    const allowedRoles = ['super_admin', 'school_manager', 'education_manager', 'education_officer'];
    const usernameUpper = String(user.username || '').toUpperCase();
    const isAuthorized =
      allowedRoles.includes(user.role) ||
      usernameUpper === 'SADEGH' ||
      usernameUpper === 'SHAH';

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'دسترسی غیرمجاز: فقط سوپر ادمین، مدیر مدرسه و مسئول آموزش مجاز به ارسال دستور هارد رفرش هستند.',
      });
    }

    const result = await setForceReloadVersion(
      String(user.username || user.id || 'admin'),
      String(user.name || user.username || 'مدیر')
    );

    try {
      await MysqlRepository.recordAuditLog({
        userId: String(user.id || ''),
        username: String(user.username || ''),
        action: 'SYSTEM_FORCE_RELOAD',
        entityType: 'system_settings',
        entityId: 'force_reload_config',
        description: `اعمال نسخه جدید (هارد رفرش تکباره) با شناسه ${result.forceReloadVersion} توسط ${user.name || user.username}`,
        ipAddress: req.ip || '',
      });
    } catch (auditErr: any) {
      console.warn('[Audit Log Notice - force-reload]:', auditErr?.message || auditErr);
    }

    return res.json({
      success: true,
      forceReloadVersion: result.forceReloadVersion,
      version: result.version,
      updatedAt: result.updatedAt,
      message: 'دستور بروزرسانی ثبت شد؛ هر کاربر در ورود فعلی یا بعدی خود دقیقاً یک بار نسخه جدید را دریافت خواهد کرد.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطا در ثبت دستور بروزرسانی سراسری';
    console.error('[SYSTEM_FORCE_RELOAD_ERROR]', err);
    return res.status(500).json({ success: false, message });
  }
});

/**
 * GET /api/system/db-status
 * Endpoint to quickly check if the server's connection to MySQL is active and healthy.
 * Helps administrators debug ENV connection variables (Host, Port, DB, User) in real-time.
 */
router.get('/db-status', async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const { parseMysqlConfig, ensurePerformanceIndexes } = await import('../lib/databaseAbstraction');
  const conf = parseMysqlConfig();
  let connected = false;

  if (conf.isConfigured) {
    connected = await testMysqlConnection();
    if (connected) {
      await ensurePerformanceIndexes().catch(() => {});
    }
  }

  const status = getDbConnectionStatus();
  return res.json({
    success: true,
    isMysqlConfigured: conf.isConfigured,
    connected,
    host: conf.host || '',
    port: conf.port || 3306,
    database: conf.database || '',
    user: conf.user || '',
    lastError: status.lastError,
    engine: 'MySQL'
  });
});

/**
 * GET /api/system/maintenance-status
 * Public/Authenticated probe returning current maintenance status (always accessible even when maintenance is ON).
 */
router.get('/maintenance-status', async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    const { ensureMaintenanceLoadedFromDb } = await import('../lib/serverMaintenance');
    const state = await ensureMaintenanceLoadedFromDb();
    return res.json({
      success: true,
      enabled: Boolean(state.enabled),
      message: state.message,
      estimatedDuration: state.estimatedDuration,
      enabledAt: state.enabledAt,
      enabledBy: state.enabledBy,
      version: state.version || 1,
      updated_at: state.updated_at
    });
  } catch (err: any) {
    console.error('[STORAGE_FAILURE][maintenance-status]', err?.message || err);
    return res.status(500).json({ success: false, message: err?.message || 'خطا در بررسی وضعیت تعمیر سایت' });
  }
});

function doesAnnouncementMatchUserAudience(announcement: any, user: any): boolean {
  const audience = String(announcement?.targetAudience || 'all');
  if (audience === 'all') return true;
  if (!user) return false;
  const role = String(user.role || '');
  const level = Number(user.level) || 0;
  if (audience === 'students') {
    return (level === 3 || role === 'student' || role === 'class_representative') && role !== 'teacher';
  }
  if (audience === 'teachers') {
    return role === 'teacher';
  }
  if (audience === 'staff') {
    return level === 1 || level === 2 || role === 'super_admin' || role === 'education_manager' || role === 'education_officer' || role === 'finance_manager' || role === 'grade_mentor' || role === 'research_manager';
  }
  return true;
}

/**
 * GET /api/system/announcements/active
 * Authoritative read of active announcements targeted to the caller + caller's permanent dismissals.
 */
router.get('/announcements/active', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    }
    const verification = verifyAccessToken(token);
    if (!verification.valid || !verification.decoded) {
      return res.status(401).json({ success: false, message: 'اعتبار جلسه کاربری منقضی شده است.' });
    }
    const user = verification.decoded as any;
    const { serverQueryCollection } = await import('../lib/serverDataApi');
    const allAnnouncements = await serverQueryCollection('announcements', user);
    const activeAnnouncements = (allAnnouncements || [])
      .filter((a: any) => a && a.isActive !== false && doesAnnouncementMatchUserAudience(a, user))
      .sort((a: any, b: any) => {
        const prioWeight = (p: string) => (p === 'urgent' ? 3 : p === 'important' ? 2 : 1);
        const diff = prioWeight(b.priority) - prioWeight(a.priority);
        if (diff !== 0) return diff;
        return new Date(b.createdAt || b.updated_at || 0).getTime() - new Date(a.createdAt || a.updated_at || 0).getTime();
      });

    const userDismissals = await serverQueryCollection('announcement_dismissals', user);
    const candidates = [user.id, user.studentId, user.linkedStudentId, user.username]
      .filter(Boolean)
      .map((x: any) => String(x).trim().toLowerCase());

    const dismissedIds = Array.from(
      new Set(
        (userDismissals || [])
          .filter((d: any) => {
            if (!d || !d.announcementId) return false;
            const dU = String(d.userId || '').trim().toLowerCase();
            const dS = String(d.studentId || '').trim().toLowerCase();
            const dName = String(d.username || '').trim().toLowerCase();
            return (dU && candidates.includes(dU)) || (dS && candidates.includes(dS)) || (dName && candidates.includes(dName));
          })
          .map((d: any) => String(d.announcementId))
      )
    );

    return res.json({
      success: true,
      announcements: activeAnnouncements,
      dismissedIds
    });
  } catch (err: any) {
    console.error('[STORAGE_FAILURE][announcements/active]', err?.message || err);
    return res.status(500).json({ success: false, message: err?.message || 'خطا در واکشی اطلاعیه‌های فعال' });
  }
});

/**
 * POST /api/system/announcements/:id/dismiss
 * Persists a permanent per-user/per-student dismissal ("دیگر به من نمایش نده") in database.
 */
router.post('/announcements/:id/dismiss', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    }
    const verification = verifyAccessToken(token);
    if (!verification.valid || !verification.decoded) {
      return res.status(401).json({ success: false, message: 'اعتبار جلسه کاربری منقضی شده است.' });
    }
    const user = verification.decoded as any;
    const announcementId = String(req.params.id || '').trim();
    if (!announcementId) {
      return res.status(400).json({ success: false, message: 'شناسه اطلاعیه نامعتبر است.' });
    }

    const userKeyRaw = user.studentId || user.linkedStudentId || user.id || user.username || 'unknown';
    const userKeyClean = String(userKeyRaw).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const dismissalId = `${announcementId}__${userKeyClean}`;
    const nowIso = new Date().toISOString();

    const { serverQueryCollection, serverSaveDoc } = await import('../lib/serverDataApi');
    const existingList = await serverQueryCollection('announcement_dismissals', user);
    const existingDoc = (existingList || []).find((d: any) => d.id === dismissalId);
    const nextVersion = (Number(existingDoc?.version) || 0) + 1;

    const payload = {
      id: dismissalId,
      announcementId,
      userId: String(user.id || user.username || ''),
      studentId: String(user.studentId || user.linkedStudentId || ''),
      username: String(user.username || ''),
      dismissedAt: nowIso,
      updated_at: nowIso,
      version: nextVersion
    };

    const saveRes = await serverSaveDoc('announcement_dismissals', payload, user);
    if (!saveRes.success) {
      return res.status(500).json({ success: false, message: saveRes.error || 'خطا در ثبت دائمی عدم نمایش اطلاعیه' });
    }

    const updatedDismissals = await serverQueryCollection('announcement_dismissals', user);
    const candidates = [user.id, user.studentId, user.linkedStudentId, user.username]
      .filter(Boolean)
      .map((x: any) => String(x).trim().toLowerCase());
    const dismissedIds = Array.from(
      new Set(
        (updatedDismissals || [])
          .filter((d: any) => {
            if (!d || !d.announcementId) return false;
            const dU = String(d.userId || '').trim().toLowerCase();
            const dS = String(d.studentId || '').trim().toLowerCase();
            const dName = String(d.username || '').trim().toLowerCase();
            return (dU && candidates.includes(dU)) || (dS && candidates.includes(dS)) || (dName && candidates.includes(dName));
          })
          .map((d: any) => String(d.announcementId))
      )
    );

    console.log('[STORAGE_SUCCESS][announcement_dismissals]', dismissalId, `v${nextVersion}`);
    return res.json({
      success: true,
      dismissal: payload,
      dismissedIds
    });
  } catch (err: any) {
    console.error('[STORAGE_FAILURE][announcements/dismiss]', err?.message || err);
    return res.status(500).json({ success: false, message: err?.message || 'خطا در ثبت عدم نمایش اطلاعیه' });
  }
});

export default router;

