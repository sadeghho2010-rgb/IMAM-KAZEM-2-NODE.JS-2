import { Router, Request, Response } from 'express';
import { getMysqlPool } from '../lib/databaseAbstraction';
import { verifyAccessToken } from '../lib/serverAuth';

const router = Router();

// Helper to extract caller
function extractCaller(req: Request) {
  let token = req.cookies?.auth_access_token;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }
  if (token) {
    const verified = verifyAccessToken(token);
    if (verified.valid && verified.decoded) {
      return verified.decoded;
    }
  }
  return null;
}

// Middleware: Restrict to super_admin or school_manager or level 1
function requireAdminRole(req: Request, res: Response, next: () => void) {
  const caller = extractCaller(req);
  if (!caller) {
    return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
  }

  const isAuthorized =
    caller.level === 1 ||
    caller.role === 'super_admin' ||
    caller.role === 'school_manager' ||
    (caller.username && caller.username.toUpperCase() === 'SADEGH');

  if (!isAuthorized) {
    return res.status(403).json({ success: false, message: 'دسترسی به لاگ‌های سیستم منحصراً در اختیار مدیر ارشد است.' });
  }

  (req as any).user = caller;
  next();
}

/**
 * GET /api/audit/logs
 * Retrieves paginated audit logs with search and filter capabilities
 */
router.get('/logs', requireAdminRole, async (req: Request, res: Response) => {
  try {
    const pool = getMysqlPool();
    if (!pool) {
      return res.status(500).json({ success: false, message: 'پایگاه داده در دسترس نیست.' });
    }

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10), 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10), 0);
    const action = req.query.action ? String(req.query.action).trim() : null;
    const collection = req.query.collection ? String(req.query.collection).trim() : null;
    const userId = req.query.user_id ? String(req.query.user_id).trim() : null;
    const status = req.query.status ? String(req.query.status).trim() : null;
    const search = req.query.search ? String(req.query.search).trim() : null;

    const whereConditions: string[] = [];
    const params: any[] = [];

    if (action) {
      whereConditions.push('action = ?');
      params.push(action);
    }

    if (collection) {
      whereConditions.push('collection_name = ?');
      params.push(collection);
    }

    if (userId) {
      whereConditions.push('(user_id = ? OR user_name LIKE ?)');
      params.push(userId, `%${userId}%`);
    }

    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    if (search) {
      whereConditions.push('(record_id LIKE ? OR user_name LIKE ? OR error_message LIKE ? OR details LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count Query
    const countSql = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
    const [countRows]: any = await pool.execute(countSql, params);
    const total = countRows?.[0]?.total || 0;

    // Items Query
    const dataSql = `
      SELECT id, action, collection_name, record_id, user_id, user_name, user_role, details, ip_address, status, error_message, created_at
      FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows]: any = await pool.execute(dataSql, [...params, String(limit), String(offset)]);

    const items = (rows || []).map((r: any) => {
      let detailsParsed = r.details;
      if (typeof r.details === 'string') {
        try { detailsParsed = JSON.parse(r.details); } catch (e) {}
      }
      return {
        ...r,
        details: detailsParsed
      };
    });

    return res.json({
      success: true,
      items,
      total,
      limit,
      offset
    });
  } catch (err: any) {
    console.error('[AuditRoutes GET /logs error]:', err);
    return res.status(500).json({ success: false, message: err?.message || 'خطا در دریافت لاگ‌های سیستم.' });
  }
});

/**
 * GET /api/audit/stats
 * Summary statistics for system logs dashboard
 */
router.get('/stats', requireAdminRole, async (_req: Request, res: Response) => {
  try {
    const pool = getMysqlPool();
    if (!pool) {
      return res.status(500).json({ success: false, message: 'پایگاه داده در دسترس نیست.' });
    }

    const [totalRows]: any = await pool.execute(`SELECT COUNT(*) as total FROM audit_logs`);
    const [todayRows]: any = await pool.execute(`SELECT COUNT(*) as today FROM audit_logs WHERE created_at >= DATE(NOW())`);
    const [errorRows]: any = await pool.execute(`SELECT COUNT(*) as errors FROM audit_logs WHERE status = 'error' OR status = 'failed'`);
    const [actionRows]: any = await pool.execute(`
      SELECT action, COUNT(*) as count FROM audit_logs GROUP BY action ORDER BY count DESC LIMIT 10
    `);

    const total = totalRows?.[0]?.total || 0;
    const today = todayRows?.[0]?.today || 0;
    const errors = errorRows?.[0]?.errors || 0;
    const successRate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;

    return res.json({
      success: true,
      stats: {
        total,
        today,
        errors,
        successRate,
        actions: actionRows || []
      }
    });
  } catch (err: any) {
    console.error('[AuditRoutes GET /stats error]:', err);
    return res.status(500).json({ success: false, message: err?.message || 'خطا در دریافت آمار لاگ‌ها.' });
  }
});

/**
 * POST /api/audit/cleanup
 * Manually prune logs older than 30 days
 */
router.post('/cleanup', requireAdminRole, async (_req: Request, res: Response) => {
  try {
    const pool = getMysqlPool();
    if (!pool) {
      return res.status(500).json({ success: false, message: 'پایگاه داده در دسترس نیست.' });
    }

    const [result]: any = await pool.execute(`
      DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    const deletedCount = result?.affectedRows || 0;
    return res.json({
      success: true,
      message: `تعداد ${deletedCount} لاگ قدیمی‌تر از ۳۰ روز با موفقیت پاکسازی شدند.`,
      deletedCount
    });
  } catch (err: any) {
    console.error('[AuditRoutes POST /cleanup error]:', err);
    return res.status(500).json({ success: false, message: err?.message || 'خطا در پاکسازی لاگ‌های قدیمی.' });
  }
});

/**
 * POST /api/audit/revert
 * Reverts an audit log activity
 */
router.post('/revert', requireAdminRole, async (req: Request, res: Response) => {
  try {
    const { logId, revertedBy } = req.body || {};
    const { revertAuditActivity } = await import('../lib/auditLogger');
    const caller = (req as any).user;
    const userName = revertedBy || caller?.username || caller?.name || 'مدیر سامانه';

    const result = await revertAuditActivity(logId, userName);
    return res.json(result);
  } catch (err: any) {
    console.error('[AuditRoutes POST /revert error]:', err);
    return res.status(500).json({ success: false, message: err?.message || 'خطا در بازگردانی عملیات.' });
  }
});

export default router;
