import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import {
  serverQueryCollection,
  serverSaveDoc,
  serverDeleteDoc,
  serverGetDocByCandidateIds,
  authorizeCollectionAccess
} from '../lib/serverDataApi';
import { verifyAccessToken, logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';

const router = Router();

const extractToken = (req: Request): string | null => {
  if (req.cookies) {
    if (req.cookies.auth_access_token) return req.cookies.auth_access_token;
    if (req.cookies.auth_token) return req.cookies.auth_token;
    if (req.cookies.access_token) return req.cookies.access_token;
    if (req.cookies.token) return req.cookies.token;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
};

// ===================== DATABASE SNAPSHOT & BACKUP ENDPOINTS =====================

// GET /api/database/snapshot
router.get('/database/snapshot', async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });

  const verification = verifyAccessToken(token);
  if (!verification.valid || !verification.decoded || verification.decoded.level > 2) {
    return res.status(403).json({ success: false, message: 'مجوز تهیه نسخه پشتیبان دیتابیس را ندارید.' });
  }

  const { createFullDatabaseSnapshot } = await import('../lib/serverBackupEngine');
  try {
    const snapshot = await createFullDatabaseSnapshot(verification.decoded.username, false);
    const filename = `madrasah_backup_${snapshot.metadata.timestamp.substring(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(snapshot, null, 2));
  } catch (err: unknown) {
    return res.status(500).json({ success: false, message: 'خطا در تهیه نسخه پشتیبان کامل دیتابیس.' });
  }
});

// POST /api/database/restore-snapshot
router.post('/database/restore-snapshot', async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });

  const verification = verifyAccessToken(token);
  if (!verification.valid || !verification.decoded || verification.decoded.level !== 1) {
    return res.status(403).json({ success: false, message: 'فقط سوپر ادمین (سطح ۱) مجاز به بازگردانی کامل پایگاه داده است.' });
  }

  const { snapshotPayload } = req.body || {};
  if (!snapshotPayload || !snapshotPayload.data) {
    return res.status(400).json({ success: false, message: 'محتوای فایل پشتیبان نامعتبر است.' });
  }

  const { restoreDatabaseSnapshot } = await import('../lib/serverBackupEngine');
  const result = await restoreDatabaseSnapshot(snapshotPayload, verification.decoded.username, getClientIp(req));
  return res.status(result.success ? 200 : 400).json(result);
});

// GET /api/database/scheduled-backups
router.get('/database/scheduled-backups', async (req: Request, res: Response) => {
  const { listOnDiskBackups } = await import('../lib/serverBackupEngine');
  const backups = listOnDiskBackups();
  return res.json({ success: true, backups });
});

// POST /api/database/scheduled-backups/run-now
router.post('/database/scheduled-backups/run-now', async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });

  const verification = verifyAccessToken(token);
  if (!verification.valid || !verification.decoded || verification.decoded.level > 2) {
    return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز' });
  }

  const { createFullDatabaseSnapshot } = await import('../lib/serverBackupEngine');
  const snapshot = await createFullDatabaseSnapshot(verification.decoded.username, true);
  return res.json({
    success: true,
    message: `نسخه پشتیبان خودکار با موفقیت ذخیره شد (${snapshot.metadata.totalRecordsCount} رکورد).`,
    metadata: snapshot.metadata
  });
});

// ===================== AUDIT LOG HASH CHAIN VERIFICATION =====================

router.get('/audit-logs/verify-chain', async (req: Request, res: Response) => {
  try {
    const { verifyAuditChain } = await import('../lib/serverAuditChain');
    const logs = await serverQueryCollection('audit_logs');
    const result = verifyAuditChain(Array.isArray(logs) ? logs : []);
    return res.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطا در اعتبارسنجی زنجیره لاگ‌ها';
    return res.status(500).json({ success: false, message });
  }
});

// ===================== SECURE DEDICATED DATA API ENDPOINTS =====================

// GET /api/data/:collection
router.get('/data/:collection', async (req: Request, res: Response) => {
  const { collection } = req.params;
  const token = extractToken(req);
  let callerUser = null;

  if (token) {
    const verification = verifyAccessToken(token);
    if (verification.valid && verification.decoded) {
      callerUser = verification.decoded;
    }
  }

  const authCheck = authorizeCollectionAccess(callerUser, collection, 'read');
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز' });
  }

  try {
    const items = await serverQueryCollection(collection, callerUser);
    return res.json({ success: true, items });
  } catch (err) {
    logger.error(`Error querying collection ${collection}:`, err);
    return res.status(500).json({ success: false, message: 'خطا در دریافت اطلاعات از سرور.' });
  }
});

// GET /api/data/:collection/:id
router.get('/data/:collection/:id', async (req: Request, res: Response) => {
  const { collection, id } = req.params;
  const token = extractToken(req);
  let callerUser = null;

  if (token) {
    const verification = verifyAccessToken(token);
    if (verification.valid && verification.decoded) {
      callerUser = verification.decoded;
    }
  }

  const authCheck = authorizeCollectionAccess(callerUser, collection, 'read');
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز' });
  }

  try {
    const item = await serverGetDocByCandidateIds(collection, [id], callerUser);
    if (!item) {
      return res.status(404).json({ success: false, message: 'رکورد مورد نظر یافت نشد.' });
    }
    return res.json({ success: true, item });
  } catch (err) {
    logger.error(`Error querying document ${id} in ${collection}:`, err);
    return res.status(500).json({ success: false, message: 'خطا در دریافت رکورد از سرور.' });
  }
});

// POST /api/data/:collection
router.post('/data/:collection', async (req: Request, res: Response) => {
  const { collection } = req.params;
  const token = extractToken(req);
  let callerUser = null;

  if (token) {
    const verification = verifyAccessToken(token);
    if (verification.valid && verification.decoded) {
      callerUser = verification.decoded;
    }
  }

  const data = req.body;
  const recordOwnerId = data?.userId || data?.studentId;
  const authCheck = authorizeCollectionAccess(callerUser, collection, 'write', recordOwnerId);
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز' });
  }

  try {
    const saveRes = await serverSaveDoc(collection, data, callerUser);
    if (!saveRes.success) {
      return res.status(500).json({ success: false, message: saveRes.error || 'خطا در ذخیره‌سازی داده' });
    }

    if (callerUser) {
      logServerAudit({
        userId: callerUser.userId,
        username: callerUser.username,
        userRole: callerUser.role,
        action: 'DATA_WRITE',
        entityType: collection,
        entityId: saveRes.id,
        description: `ثبت یا ویرایش رکورد در کالکشن ${collection} توسط ${callerUser.username}`,
        ipAddress: getClientIp(req)
      }).catch(() => {});
    }

    return res.json({ success: true, id: saveRes.id });
  } catch (err) {
    logger.error(`Error writing to collection ${collection}:`, err);
    return res.status(500).json({ success: false, message: 'خطا در ذخیره اطلاعات در سرور.' });
  }
});

// PUT /api/data/:collection/:id
router.put('/data/:collection/:id', async (req: Request, res: Response) => {
  const { collection, id } = req.params;
  const token = extractToken(req);
  let callerUser = null;

  if (token) {
    const verification = verifyAccessToken(token);
    if (verification.valid && verification.decoded) {
      callerUser = verification.decoded;
    }
  }

  const data = { ...req.body, id };
  const recordOwnerId = data?.userId || data?.studentId;
  const authCheck = authorizeCollectionAccess(callerUser, collection, 'write', recordOwnerId);
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز' });
  }

  try {
    const saveRes = await serverSaveDoc(collection, data, callerUser);
    if (!saveRes.success) {
      return res.status(500).json({ success: false, message: saveRes.error || 'خطا در ویرایش داده' });
    }

    return res.json({ success: true, id: saveRes.id });
  } catch (err) {
    logger.error(`Error updating collection ${collection}:`, err);
    return res.status(500).json({ success: false, message: 'خطا در ویرایش اطلاعات در سرور.' });
  }
});

// DELETE /api/data/:collection/:id
router.delete('/data/:collection/:id', async (req: Request, res: Response) => {
  const { collection, id } = req.params;
  const token = extractToken(req);
  let callerUser = null;

  if (token) {
    const verification = verifyAccessToken(token);
    if (verification.valid && verification.decoded) {
      callerUser = verification.decoded;
    }
  }

  const authCheck = authorizeCollectionAccess(callerUser, collection, 'delete');
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز' });
  }

  try {
    const delRes = await serverDeleteDoc(collection, id, callerUser);
    if (!delRes.success) {
      return res.status(500).json({ success: false, message: delRes.error || 'خطا در حذف داده' });
    }

    if (callerUser) {
      logServerAudit({
        userId: callerUser.userId,
        username: callerUser.username,
        userRole: callerUser.role,
        action: 'DATA_DELETE',
        entityType: collection,
        entityId: id,
        description: `حذف رکورد ${id} از کالکشن ${collection} توسط ${callerUser.username}`,
        ipAddress: getClientIp(req)
      }).catch(() => {});
    }

    return res.json({ success: true, message: 'رکورد با موفقیت حذف شد.' });
  } catch (err) {
    logger.error(`Error deleting from collection ${collection}:`, err);
    return res.status(500).json({ success: false, message: 'خطا در حذف اطلاعات در سرور.' });
  }
});

// POST /api/data/:collection/batch
router.post('/data/:collection/batch', async (req: Request, res: Response) => {
  const { collection } = req.params;
  const token = extractToken(req);
  let callerUser = null;

  if (token) {
    const verification = verifyAccessToken(token);
    if (verification.valid && verification.decoded) {
      callerUser = verification.decoded;
    }
  }

  const authCheck = authorizeCollectionAccess(callerUser, collection, 'write');
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز' });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ success: false, message: 'آیتم‌ها باید آرایه‌ای باشند.' });
  }

  try {
    for (const item of items) {
      await serverSaveDoc(collection, item, callerUser);
    }
    return res.json({ success: true, count: items.length });
  } catch (err) {
    logger.error(`Error batch saving ${collection}:`, err);
    return res.status(500).json({ success: false, message: 'خطا در ذخیره دسته‌ای اطلاعات.' });
  }
});

// ===================== SYSTEM & BUG REPORTING ENDPOINTS =====================

router.post('/system/save-background-image', async (req: Request, res: Response) => {
  try {
    const { imageBase64, target } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'تصویری ارسال نشده است.' });
    }
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    if (target === 'mobile') {
      fs.writeFileSync(path.join(publicDir, '000-mobile.jpg'), buffer);
    } else {
      fs.writeFileSync(path.join(publicDir, 'login-bg.jpg'), buffer);
      fs.writeFileSync(path.join(publicDir, '000.jpg'), buffer);
    }
    return res.json({ success: true, message: 'تصویر پس‌زمینه با موفقیت در دیسک ذخیره شد.' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'خطا در ذخیره تصویر';
    return res.status(500).json({ error: message });
  }
});

router.post('/bug-reports', async (req: Request, res: Response) => {
  try {
    const { title, description, severity, pageUrl, browserInfo, osInfo, userAgent, userId, userName } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'عنوان و شرح دقیق خطا الزامی است.' });
    }

    const reportId = 'bug_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newBug = {
      id: reportId,
      title: String(title).trim(),
      description: String(description).trim(),
      severity: severity || 'medium',
      status: 'open',
      pageUrl: pageUrl || '/',
      browserInfo: browserInfo || 'Unknown',
      osInfo: osInfo || 'Unknown',
      userAgent: userAgent || '',
      userId: userId || 'anonymous',
      userName: userName || 'کاربر ناشناس',
      createdAt: new Date().toISOString()
    };

    await serverSaveDoc('bug_reports', newBug);
    logger.warn(`[BUG REPORTED] ${title} (${severity}) by ${userName || 'user'} on ${pageUrl}`);

    return res.status(201).json({ success: true, message: 'گزارش خطا با موفقیت ثبت شد.', reportId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'خطا در ثبت گزارش';
    return res.status(500).json({ success: false, message });
  }
});

router.get('/bug-reports', async (req: Request, res: Response) => {
  try {
    const items = await serverQueryCollection('bug_reports');
    return res.json({ success: true, items });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'خطا در دریافت گزارش‌ها';
    return res.status(500).json({ success: false, message });
  }
});

// ===================== REALTIME SSE SYNC ENDPOINTS =====================

// GET /api/sync/events
router.get('/sync/events', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  const { registerRealtimeListener } = await import('../lib/serverDataApi');
  const unsubscribe = registerRealtimeListener((event) => {
    try {
      res.write(`event: data_change\ndata: ${JSON.stringify(event)}\n\n`);
    } catch (e) {}
  });

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (e) {}
  }, 30000);

  req.on('close', () => {
    unsubscribe();
    clearInterval(heartbeat);
  });
});

// GET /api/sync/changes
router.get('/sync/changes', async (_req: Request, res: Response) => {
  return res.json({ success: true, changes: [] });
});

export default router;
