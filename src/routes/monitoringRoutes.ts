/**
 * Monitoring API Routes
 * Exposes endpoints for client error ingestion, querying issues, and running retention.
 * Strict role-based protection (Super Admin, Education Manager, Finance Manager).
 */

import { Router, Request, Response } from 'express';
import { requireMonitoringAccess } from '../config/monitoringAccess';
import { 
  recordMonitoringEvent, 
  runMonitoringPurge 
} from '../lib/monitoringService';
import { getMysqlPool } from '../lib/databaseAbstraction';

const router = Router();

/**
 * POST /api/monitor/client-event
 * Ingests errors from browser/client (window.onerror, fetch failure, chunk fail, etc.)
 * Public endpoint to catch pre-login and post-login issues, protected by size & rate limiter.
 */
router.post('/client-event', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const {
      eventType,
      severity,
      sectionName,
      routePath,
      statusCode,
      shortMessage,
      stack,
      appVersion,
      userId,
      userRole,
      displayName,
      metadata
    } = body;

    if (!shortMessage || typeof shortMessage !== 'string') {
      return res.status(400).json({ success: false, message: 'پیام خطا الزامی است.' });
    }

    recordMonitoringEvent({
      eventType: eventType || 'client_error',
      severity: severity || 'error',
      sectionName,
      routePath,
      statusCode: Number(statusCode) || undefined,
      shortMessage,
      stack,
      appVersion,
      userId,
      userRole,
      displayName,
      metadata
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'خطای داخلی در ثبت رویداد' });
  }
});

/**
 * GET /api/monitor/events
 * Returns filtered list of monitoring events.
 * Strict access: Super Admin, Education Manager, Finance Manager only.
 */
router.get('/events', requireMonitoringAccess, async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const pool = getMysqlPool();
  if (!pool) {
    return res.json({ success: true, events: [], total: 0, notice: 'دیتابیس MySQL متصل نیست.' });
  }

  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const severity = req.query.severity as string;
    const eventType = req.query.eventType as string;
    const search = req.query.search as string;

    const whereClauses: string[] = ['1=1'];
    const params: any[] = [];

    if (severity && severity !== 'all') {
      whereClauses.push('`severity` = ?');
      params.push(severity);
    }

    if (eventType && eventType !== 'all') {
      whereClauses.push('`event_type` = ?');
      params.push(eventType);
    }

    if (search && search.trim()) {
      whereClauses.push('(`short_message` LIKE ? OR `section_name` LIKE ? OR `request_id` LIKE ? OR `display_name` LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    const whereSql = whereClauses.join(' AND ');

    const [rows]: any = await pool.query(`
      SELECT 
        \`id\`, \`created_at\`, \`event_type\`, \`severity\`, \`fingerprint\`,
        \`section_name\`, \`route_path\`, \`status_code\`, \`duration_ms\`,
        \`request_id\`, \`user_id\`, \`user_role\`, \`display_name\`,
        \`short_message\`, \`short_stack\`, \`app_version\`, \`metadata_json\`
      FROM \`mon_events\`
      WHERE ${whereSql}
      ORDER BY \`created_at\` DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const [countRes]: any = await pool.query(`
      SELECT COUNT(*) as total FROM \`mon_events\` WHERE ${whereSql}
    `, params);

    return res.json({
      success: true,
      events: rows || [],
      total: Number(countRes?.[0]?.total || 0),
      limit,
      offset
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'خطا در واکشی رویدادها' });
  }
});

/**
 * POST /api/monitor/purge
 * Manually trigger retention purge (older than 14 days or > 20,000 rows)
 * Strict access: Super Admin, Education Manager, Finance Manager only.
 */
router.post('/purge', requireMonitoringAccess, async (_req: Request, res: Response) => {
  try {
    const result = await runMonitoringPurge();
    return res.json({
      success: true,
      message: `پاکسازی با موفقیت انجام شد. تعداد ${result.deletedCount} رویداد قدیمی یا مازاد حذف گردید.`,
      deletedCount: result.deletedCount
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'خطا در اجرای پاکسازی' });
  }
});

/**
 * GET /api/monitor/maintenance
 * Gets current maintenance state
 * Strict access: Super Admin, Education Manager, Finance Manager
 */
router.get('/maintenance', requireMonitoringAccess, async (_req: Request, res: Response) => {
  const { getMaintenanceState } = await import('../lib/serverMaintenance');
  return res.json({ success: true, state: getMaintenanceState() });
});

/**
 * POST /api/monitor/maintenance
 * Toggle maintenance mode on or off
 * Strict access: Super Admin, Education Manager, Finance Manager
 * Logs to audit_logs
 */
router.post('/maintenance', requireMonitoringAccess, async (req: Request, res: Response) => {
  try {
    const { enabled, message, estimatedDuration } = req.body || {};
    const { setMaintenanceState } = await import('../lib/serverMaintenance');
    const { logServerAudit } = await import('../lib/serverAuth');

    const caller = (req as any).monitoringCaller || {};
    const operatorName = caller.name || caller.username || 'مدیر سامانه';

    const newState = setMaintenanceState(
      Boolean(enabled),
      operatorName,
      message,
      estimatedDuration
    );

    // Record action into audit_logs (Rule 6)
    await logServerAudit({
      userId: caller.id || 'admin',
      username: caller.username || 'admin',
      userRole: caller.role || 'manager',
      action: enabled ? 'MAINTENANCE_MODE_ACTIVATED' : 'MAINTENANCE_MODE_DEACTIVATED',
      entityType: 'system_settings',
      entityId: 'maintenance_mode',
      description: enabled
        ? `فعال‌سازی حالت تعمیر و بروزرسانی سامانه توسط ${operatorName} (پیام: ${message || 'پیش‌فرض'})`
        : `غیرفعال‌سازی حالت تعمیر و بازگشایی سامانه توسط ${operatorName}`,
      newState
    });

    return res.json({
      success: true,
      message: enabled ? 'حالت تعمیر سامانه فعال شد.' : 'حالت تعمیر غیرفعال شد و سامانه در دسترس قرار گرفت.',
      state: newState
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'خطا در تغییر حالت تعمیر' });
  }
});

export default router;
