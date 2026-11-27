import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import {
  serverQueryCollection,
  serverSaveDoc,
  serverDeleteDoc,
  serverGetDocByCandidateIds,
  authorizeCollectionAccess,
  fetchBootstrapData,
  getRawExistingDocById,
  canUserReadDoc,
  isStudentLevelUser,
  isClassRepresentativeUser,
  resolveAuthoritativeStudentIdentity
} from '../lib/serverDataApi';
import { verifyAccessToken, logServerAudit, fetchAllUsersFromStorage, fetchUserByUsername } from '../lib/serverAuth';
import { MysqlRepository } from '../lib/databaseAbstraction';
import { logger } from '../lib/logger';

const router = Router();

// Anti-stale cache headers across all data endpoints to prevent stale browser/proxy caching
router.use((req: Request, res: Response, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Idempotency cache to deduplicate retried writes and prevent double insertions
const processedIdempotencyKeys = new Map<string, { timestamp: number; result: any }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of processedIdempotencyKeys.entries()) {
    if (now - val.timestamp > 120000) { // 2 minutes TTL
      processedIdempotencyKeys.delete(key);
    }
  }
}, 60000);

const getEnrichedCallerUser = async (decoded: any): Promise<any> => {
  if (!decoded) return null;
  try {
    const cleanUser = String(decoded.username || '').trim().toUpperCase();
    if (cleanUser) {
      const fastMatched = await fetchUserByUsername(cleanUser);
      if (fastMatched) {
        return { ...fastMatched, ...decoded };
      }
    }
    const allUsers = await fetchAllUsersFromStorage();
    const uId = String(decoded.userId || decoded.id || '');
    const matched = allUsers.find(u =>
      (cleanUser && u.username && u.username.toUpperCase() === cleanUser) ||
      (uId && u.id === uId)
    );
    if (matched) {
      return { ...matched, ...decoded };
    }
  } catch (e) {}
  return decoded;
};

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
  if (req.query && typeof req.query.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
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

const STUDENT_SELF_ONLY_COLLECTIONS = new Set([
  'student_requests',
  'study_daily_entries',
  'periodic_study_logs',
  'course_selection_requests',
  'student_meal_reservations',
  'finance_student_meal_reservations',
  'meal_reservations',
  'lunch_reservations',
  'received_articles',
  'evaluation_requests',
  'custom_student_schedules',
  'personal_todos',
  'user_todo_categories',
  'assigned_todos',
  'workflow_items',
  'announcement_dismissals'
]);

async function enforceStudentMutationSecurity(
  collection: string,
  rawData: any,
  callerUser: any,
  isDelete = false,
  explicitId?: string
): Promise<{ allowed: boolean; status?: number; reason?: string; data?: any }> {
  if (!callerUser || !isStudentLevelUser(callerUser)) {
    return { allowed: true, data: rawData };
  }

  const isRep = isClassRepresentativeUser(callerUser);
  // Class representatives have delegated write/delete on attendance, representative_notes, and students
  if (isRep && (collection === 'attendance' || collection === 'representative_notes' || collection === 'students')) {
    return { allowed: true, data: rawData };
  }

  const identity = await resolveAuthoritativeStudentIdentity(callerUser);
  const targetId = String(explicitId || rawData?.id || '').trim();
  const existingDoc = targetId ? await getRawExistingDocById(collection, targetId) : null;

  // Ownership check on existing documents before update or delete
  if (existingDoc) {
    if (collection === 'attendance') {
      // Self-reporting students may only update their own entry inside a self_reporting session
    } else if (!canUserReadDoc(callerUser, collection, existingDoc, { studentCandidates: identity.candidates })) {
      return {
        allowed: false,
        status: 403,
        reason: 'شما مجاز به ویرایش یا حذف رکورد متعلق به طلبه دیگری نیستید.'
      };
    }
  }

  if (isDelete) {
    return { allowed: true, data: rawData };
  }

  const sanitized = { ...(rawData || {}) };

  if (collection === 'attendance') {
    // Only regular students in self-reporting courses may submit their own attendance
    const programId = String(sanitized.programId || sanitized.program_id || existingDoc?.programId || '').trim();
    const programDoc = programId ? await getRawExistingDocById('programs', programId) : null;
    if (!programDoc || programDoc.attendanceType !== 'self_reporting') {
      return {
        allowed: false,
        status: 403,
        reason: 'ثبت حضور و غیاب برای این درس فقط توسط استاد، نماینده کلاس یا آموزش مجاز است.'
      };
    }

    const incomingStudents = Array.isArray(sanitized.students) ? sanitized.students : [];
    const myEntry = incomingStudents[0] && typeof incomingStudents[0] === 'object' ? { ...incomingStudents[0] } : {};
    myEntry.studentId = identity.studentId;
    myEntry.studentName = identity.studentName;
    if (identity.nationalCode) myEntry.nationalId = identity.nationalCode;
    myEntry.recordedMethod = 'self_reporting';

    sanitized.students = [myEntry];
    sanitized.isCancelled = existingDoc ? Boolean(existingDoc.isCancelled) : false;
    if (existingDoc?.cancellationReason) {
      sanitized.cancellationReason = existingDoc.cancellationReason;
    } else {
      delete sanitized.cancellationReason;
    }
    return { allowed: true, data: sanitized };
  }

  if (!STUDENT_SELF_ONLY_COLLECTIONS.has(collection)) {
    return { allowed: true, data: sanitized };
  }

  if (collection === 'personal_todos' || collection === 'user_todo_categories' || collection === 'announcement_dismissals') {
    sanitized.userId = identity.userId;
    if (sanitized.user_id !== undefined) sanitized.user_id = identity.userId;
    return { allowed: true, data: sanitized };
  }

  if (collection === 'assigned_todos') {
    // Students can only update read/completion state of tasks assigned to them
    if (!existingDoc) {
      return { allowed: false, status: 403, reason: 'طلبه مجاز به ایجاد ارجاع کار جدید نیست.' };
    }
    return { allowed: true, data: sanitized };
  }

  if (collection === 'workflow_items') {
    sanitized.studentId = identity.studentId;
    sanitized.userId = identity.userId;
    if (sanitized.details && typeof sanitized.details === 'object') {
      sanitized.details = {
        ...sanitized.details,
        requestedByStudentId: identity.studentId,
        studentId: identity.studentId
      };
    }
    if (!existingDoc) {
      sanitized.status = 'pending';
    } else {
      sanitized.status = existingDoc.status;
    }
    return { allowed: true, data: sanitized };
  }

  // Student-owned collections: forcibly override identity fields from server-verified caller profile
  sanitized.studentId = identity.studentId;
  sanitized.studentName = identity.studentName;
  sanitized.userId = identity.userId;
  if ('nationalCode' in sanitized || collection === 'student_requests') {
    sanitized.nationalCode = identity.nationalCode;
  }
  if ('nationalId' in sanitized) {
    sanitized.nationalId = identity.nationalCode;
  }

  if (collection === 'student_requests') {
    if (!existingDoc) {
      sanitized.status = 'pending';
      sanitized.isTerminated = false;
      delete sanitized.officialReply;
      delete sanitized.repliedBy;
      delete sanitized.repliedByName;
      delete sanitized.repliedAt;
      delete sanitized.rejectionReason;
    } else {
      // Preserve officer-controlled resolution fields; allow student follow-up messages / isReadByStudent
      sanitized.officialReply = existingDoc.officialReply;
      sanitized.repliedBy = existingDoc.repliedBy;
      sanitized.repliedByName = existingDoc.repliedByName;
      sanitized.repliedAt = existingDoc.repliedAt;
      sanitized.rejectionReason = existingDoc.rejectionReason;
      sanitized.isTerminated = existingDoc.isTerminated;
      sanitized.terminatedAt = existingDoc.terminatedAt;
      sanitized.terminatedBy = existingDoc.terminatedBy;
      if (existingDoc.leaveDetails) {
        sanitized.leaveDetails = existingDoc.leaveDetails;
      }
      if (sanitized.status === 'resolved' || sanitized.status === 'rejected') {
        sanitized.status = existingDoc.status || 'pending';
      }
    }
  } else if (collection === 'periodic_study_logs') {
    sanitized.submittedBy = 'student';
    if (existingDoc) {
      sanitized.isExempt = existingDoc.isExempt;
      sanitized.exemptionReason = existingDoc.exemptionReason;
    } else {
      delete sanitized.isExempt;
      delete sanitized.exemptionReason;
    }
  } else if (collection === 'course_selection_requests') {
    if (!existingDoc) {
      sanitized.status = 'pending';
    } else if (sanitized.status === 'approved' || sanitized.status === 'rejected') {
      sanitized.status = existingDoc.status || 'pending';
    }
  }

  return { allowed: true, data: sanitized };
}

// GET /api/data/bootstrap - Batch fetch all collections in 1 optimized request
router.get('/data/bootstrap', async (req: Request, res: Response) => {
  const token = extractToken(req);
  let callerUser: any = { level: 3, role: 'guest' };

  if (token) {
    const verification = verifyAccessToken(token);
    if (verification.valid && verification.decoded) {
      callerUser = await getEnrichedCallerUser(verification.decoded);
    }
  }

  try {
    const data = await fetchBootstrapData(callerUser);
    return res.status(200).json({
      success: true,
      timestamp: Date.now(),
      data
    });
  } catch (error: any) {
    logger.error('[Bootstrap Route Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'خطا در بارگذاری همزمان تمام داده‌های سامانه'
    });
  }
});

// GET /api/data/teacher-portal-init - Lightweight single-request hydration exclusively for TeacherPortal
router.get('/data/teacher-portal-init', async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
  }

  const verification = verifyAccessToken(token);
  if (!verification.valid || !verification.decoded) {
    return res.status(401).json({ success: false, message: 'نشست کاربری معتبر نیست یا منقضی شده است.' });
  }

  const callerUser = await getEnrichedCallerUser(verification.decoded);
  if (!callerUser || (callerUser.role !== 'teacher' && Number(callerUser.level) > 2)) {
    return res.status(403).json({ success: false, message: 'دسترسی به این بخش مجاز نیست.' });
  }

  try {
    // Batch 1 warms shared metadata (programs, teacher_schedules, enrollments) before Batch 2 queries students context
    const batch1Cols = ['teachers', 'programs', 'teacher_schedules', 'enrollments'];
    const batch2Cols = ['students', 'counseling_session_grades', 'academic_holidays', 'academic_calendar_periods'];

    const data: Record<string, any[]> = {};
    const runBatch = async (cols: string[]) => {
      const results = await Promise.all(
        cols.map(async (col) => {
          const authCheck = authorizeCollectionAccess(callerUser, col, 'read');
          if (!authCheck.allowed) return { col, items: [] };
          const items = await serverQueryCollection(col, callerUser);
          return { col, items };
        })
      );
      for (const { col, items } of results) {
        data[col] = items;
      }
    };

    await runBatch(batch1Cols);
    await runBatch(batch2Cols);

    return res.status(200).json({
      success: true,
      timestamp: Date.now(),
      data
    });
  } catch (error: any) {
    logger.error('[Teacher Portal Init Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'خطا در بارگذاری اطلاعات پنل اساتید'
    });
  }
});

// ===================== DATABASE SNAPSHOT & BACKUP ENDPOINTS =====================
const BACKUP_WEB_UI_DISABLED_MESSAGE = 'این بخش موقتاً غیرفعال و در حال طراحی است';

// GET /api/database/snapshot - Disabled on web interface
router.get('/database/snapshot', (_req: Request, res: Response) => {
  return res.status(503).json({
    success: false,
    message: BACKUP_WEB_UI_DISABLED_MESSAGE
  });
});

// GET /api/database/full-system-export - Disabled on web interface
router.get('/database/full-system-export', (_req: Request, res: Response) => {
  return res.status(503).json({
    success: false,
    message: BACKUP_WEB_UI_DISABLED_MESSAGE
  });
});

// POST /api/database/restore-snapshot - Disabled on web interface
router.post('/database/restore-snapshot', (_req: Request, res: Response) => {
  return res.status(503).json({
    success: false,
    message: BACKUP_WEB_UI_DISABLED_MESSAGE
  });
});

// GET /api/database/scheduled-backups - Disabled on web interface
router.get('/database/scheduled-backups', (_req: Request, res: Response) => {
  return res.status(503).json({
    success: false,
    message: BACKUP_WEB_UI_DISABLED_MESSAGE
  });
});

// POST /api/database/scheduled-backups/run-now
router.post('/database/scheduled-backups/run-now', async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });

  const verification = verifyAccessToken(token);
  if (!verification.valid || !verification.decoded) {
    return res.status(403).json({ success: false, message: 'مجوز نامعتبر است.' });
  }

  const { isAuthorizedForMonitoring } = await import('../config/monitoringAccess');
  if (!isAuthorizedForMonitoring(verification.decoded)) {
    return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز برای پشتیبان‌گیری' });
  }

  const operatorName = verification.decoded.name || verification.decoded.username || 'مدیر سامانه';

  const { createFullDatabaseSnapshot } = await import('../lib/serverBackupEngine');
  const { logServerAudit } = await import('../lib/serverAuth');
  const snapshot = await createFullDatabaseSnapshot(verification.decoded.username, true);

  // Record audit log
  await logServerAudit({
    userId: String(verification.decoded.id || verification.decoded.userId || 'admin'),
    username: verification.decoded.username || 'admin',
    userRole: verification.decoded.role || 'manager',
    action: 'DATABASE_BACKUP_CREATED',
    entityType: 'database',
    entityId: snapshot.metadata?.timestamp || 'manual_backup',
    description: `ایجاد نسخه پشتیبان دستی از دیتابیس (${snapshot.metadata.totalRecordsCount} رکورد) توسط ${operatorName}`,
    ipAddress: getClientIp(req)
  });

  return res.json({
    success: true,
    message: `نسخه پشتیبان خودکار با موفقیت ذخیره شد (${snapshot.metadata.totalRecordsCount} رکورد).`,
    metadata: snapshot.metadata
  });
});

// ===================== AUDIT LOG HASH CHAIN VERIFICATION =====================

router.get('/audit-logs/verify-chain', async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
  }

  const verification = verifyAccessToken(token);
  if (!verification.valid || !verification.decoded) {
    return res.status(401).json({ success: false, message: 'نشست شما معتبر نیست یا منقضی شده است.' });
  }

  const callerUser = await getEnrichedCallerUser(verification.decoded);
  const authCheck = authorizeCollectionAccess(callerUser, 'audit_logs', 'read');
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز به اعتبارسنجی لاگ‌های امنیتی.' });
  }

  try {
    const { verifyAuditChain } = await import('../lib/serverAuditChain');
    const logs = await serverQueryCollection('audit_logs', callerUser);
    const result = verifyAuditChain(Array.isArray(logs) ? logs : []);
    return res.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطا در اعتبارسنجی زنجیره لاگ‌ها';
    return res.status(500).json({ success: false, message });
  }
});

// ===================== SECURE DEDICATED DATA API ENDPOINTS =====================

// GET /api/data/audit_logs/recent?hours=24&limit=300
router.get('/data/audit_logs/recent', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const token = extractToken(req);
  let callerUser = null;

  if (token) {
    const verification = verifyAccessToken(token);
    if (verification.valid && verification.decoded) {
      callerUser = await getEnrichedCallerUser(verification.decoded);
    }
  }

  const authCheck = authorizeCollectionAccess(callerUser, 'audit_logs', 'read');
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز' });
  }

  const rawHours = Number(req.query.hours);
  const rawLimit = Number(req.query.limit);
  const hours = Number.isFinite(rawHours) && rawHours > 0 ? Math.floor(rawHours) : 24;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 300;

  try {
    const items = await MysqlRepository.queryAuditLogsRecent(hours, limit);
    return res.json({ success: true, items });
  } catch (err) {
    logger.error('Error querying recent audit_logs:', err);
    return res.status(500).json({ success: false, message: 'خطا در دریافت لاگ‌های اخیر از سرور.' });
  }
});

// GET /api/data/:collection
router.get('/data/:collection', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const { collection } = req.params;
  const token = extractToken(req);
  let callerUser = null;

  if (token) {
    const verification = verifyAccessToken(token);
    if (verification.valid && verification.decoded) {
      callerUser = await getEnrichedCallerUser(verification.decoded);
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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const { collection, id } = req.params;
  const token = extractToken(req);
  let callerUser = null;

  if (token) {
    const verification = verifyAccessToken(token);
    if (verification.valid && verification.decoded) {
      callerUser = await getEnrichedCallerUser(verification.decoded);
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
      callerUser = await getEnrichedCallerUser(verification.decoded);
    }
  }

  const data = req.body;
  const idempotencyKey = String(req.headers['x-idempotency-key'] || data?._idempotencyKey || '').trim();
  if (idempotencyKey && processedIdempotencyKeys.has(idempotencyKey)) {
    return res.json(processedIdempotencyKeys.get(idempotencyKey)!.result);
  }

  const recordOwnerId = data?.userId || data?.studentId;
  const authCheck = authorizeCollectionAccess(callerUser, collection, 'write', recordOwnerId);
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز' });
  }

  const studentCheck = await enforceStudentMutationSecurity(collection, data, callerUser, false);
  if (!studentCheck.allowed) {
    return res.status(studentCheck.status || 403).json({ success: false, message: studentCheck.reason || 'دسترسی غیرمجاز' });
  }
  const safeData = studentCheck.data;

  try {
    const saveRes = await serverSaveDoc(collection, safeData, callerUser);
    if (!saveRes.success) {
      const statusCode = saveRes.notFound ? 404 : 500;
      return res.status(statusCode).json({ success: false, message: saveRes.error || 'خطا در ذخیره‌سازی داده' });
    }

    const resPayload = { 
      success: true, 
      id: saveRes.id, 
      item: saveRes.item || safeData, 
      affectedRows: saveRes.affectedRows ?? 1,
      changedRows: saveRes.changedRows ?? 1,
      timestamp: Date.now() 
    };
    if (idempotencyKey) {
      processedIdempotencyKeys.set(idempotencyKey, { timestamp: Date.now(), result: resPayload });
    }

    return res.json(resPayload);
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
      callerUser = await getEnrichedCallerUser(verification.decoded);
    }
  }

  const data = { ...req.body, id };
  const idempotencyKey = String(req.headers['x-idempotency-key'] || data?._idempotencyKey || '').trim();
  if (idempotencyKey && processedIdempotencyKeys.has(idempotencyKey)) {
    return res.json(processedIdempotencyKeys.get(idempotencyKey)!.result);
  }

  const recordOwnerId = data?.userId || data?.studentId;
  const authCheck = authorizeCollectionAccess(callerUser, collection, 'write', recordOwnerId);
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز' });
  }

  const studentCheck = await enforceStudentMutationSecurity(collection, data, callerUser, false, id);
  if (!studentCheck.allowed) {
    return res.status(studentCheck.status || 403).json({ success: false, message: studentCheck.reason || 'دسترسی غیرمجاز' });
  }
  const safeData = studentCheck.data;

  try {
    const saveRes = await serverSaveDoc(collection, safeData, callerUser);
    
    // Explicit logging of affectedRows and changedRows as requested
    logger.info(`[PUT Edit] Collection: "${collection}", ID: "${id}", affectedRows: ${saveRes.affectedRows ?? 1}, changedRows: ${saveRes.changedRows ?? 1}`);

    if (!saveRes.success) {
      const statusCode = saveRes.notFound ? 404 : 500;
      return res.status(statusCode).json({ success: false, message: saveRes.error || 'خطا در ویرایش داده' });
    }

    const resPayload = { 
      success: true, 
      id: saveRes.id, 
      item: saveRes.item || safeData, 
      affectedRows: saveRes.affectedRows ?? 1,
      changedRows: saveRes.changedRows ?? 1,
      timestamp: Date.now() 
    };
    if (idempotencyKey) {
      processedIdempotencyKeys.set(idempotencyKey, { timestamp: Date.now(), result: resPayload });
    }

    return res.json(resPayload);
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
      callerUser = await getEnrichedCallerUser(verification.decoded);
    }
  }

  const authCheck = authorizeCollectionAccess(callerUser, collection, 'delete');
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز' });
  }

  const studentCheck = await enforceStudentMutationSecurity(collection, { id }, callerUser, true, id);
  if (!studentCheck.allowed) {
    return res.status(studentCheck.status || 403).json({ success: false, message: studentCheck.reason || 'دسترسی غیرمجاز' });
  }

  try {
    const delRes = await serverDeleteDoc(collection, id, callerUser);
    if (!delRes.success) {
      return res.status(500).json({ success: false, message: delRes.error || 'خطا در حذف داده' });
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
      callerUser = await getEnrichedCallerUser(verification.decoded);
    }
  }

  const authCheck = authorizeCollectionAccess(callerUser, collection, 'write');
  if (!authCheck.allowed) {
    return res.status(403).json({ success: false, message: authCheck.reason || 'دسترسی غیرمجاز' });
  }

  const idempotencyKey = String(req.headers['x-idempotency-key'] || req.body?._idempotencyKey || '').trim();
  if (idempotencyKey && processedIdempotencyKeys.has(idempotencyKey)) {
    return res.json(processedIdempotencyKeys.get(idempotencyKey)!.result);
  }

  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ success: false, message: 'آیتم‌ها باید آرایه‌ای باشند.' });
  }

  try {
    const safeItems: any[] = [];
    for (const item of items) {
      const itemOwnerId = item?.userId || item?.studentId;
      const itemAuth = authorizeCollectionAccess(callerUser, collection, 'write', itemOwnerId);
      if (!itemAuth.allowed) {
        return res.status(403).json({ success: false, message: itemAuth.reason || 'دسترسی غیرمجاز' });
      }
      const studentCheck = await enforceStudentMutationSecurity(collection, item, callerUser, false);
      if (!studentCheck.allowed) {
        return res.status(studentCheck.status || 403).json({ success: false, message: studentCheck.reason || 'دسترسی غیرمجاز' });
      }
      safeItems.push(studentCheck.data);
    }

    const savedItems: any[] = [];
    for (const safeItem of safeItems) {
      const saveRes = await serverSaveDoc(collection, safeItem, callerUser);
      if (!saveRes.success) {
        return res.status(saveRes.notFound ? 404 : 500).json({
          success: false,
          message: saveRes.error || 'خطا در ذخیره‌سازی دسته‌ای اطلاعات.'
        });
      }
      savedItems.push(saveRes.item || safeItem);
    }

    const resPayload = {
      success: true,
      count: savedItems.length,
      items: savedItems,
      timestamp: Date.now()
    };
    if (idempotencyKey) {
      processedIdempotencyKeys.set(idempotencyKey, { timestamp: Date.now(), result: resPayload });
    }
    return res.json(resPayload);
  } catch (err) {
    logger.error(`Error batch saving ${collection}:`, err);
    return res.status(500).json({ success: false, message: 'خطا در ذخیره دسته‌ای اطلاعات.' });
  }
});

// ===================== SYSTEM & BUG REPORTING ENDPOINTS =====================

router.post('/system/save-background-image', async (req: Request, res: Response) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
    }

    const verification = verifyAccessToken(token);
    if (!verification.valid || !verification.decoded) {
      return res.status(401).json({ success: false, message: 'توکن امنیتی معتبر نیست یا منقضی شده است.' });
    }

    const user = verification.decoded as any;
    const isSuperAdmin = user.role === 'super_admin' || user.level === 1;
    if (!isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'تنها سوپر ادمین (سطح ۱) مجاز به تغییر تصویر پس‌زمینه سیستم است.' });
    }

    const { imageBase64, target } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, message: 'تصویری ارسال نشده است.' });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // 1. Max size check: 500 KB (512,000 bytes)
    if (buffer.length > 500 * 1024) {
      return res.status(400).json({
        success: false,
        message: `حجم تصویر ارسال شده (${(buffer.length / 1024).toFixed(1)}KB) بیش از حد مجاز ۵۰۰ کیلوبایت است.`
      });
    }

    // 2. Real WebP Magic Bytes verification (RIFF at 0..3, WEBP at 8..11)
    if (buffer.length < 12) {
      return res.status(400).json({ success: false, message: 'فرمت تصویر معتبر نیست.' });
    }
    const isRiff = buffer.toString('ascii', 0, 4) === 'RIFF';
    const isWebp = buffer.toString('ascii', 8, 12) === 'WEBP';
    if (!isRiff || !isWebp) {
      return res.status(400).json({ success: false, message: 'فقط تصاویر با فرمت واقعی WebP مجاز می‌باشند.' });
    }

    // 3. Strict fixed target filename
    const filename = target === 'mobile' ? '000-mobile.webp' : '000.webp';
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(path.join(publicDir, filename), buffer);
    return res.json({ success: true, message: `تصویر پس‌زمینه (${filename}) با موفقیت ذخیره شد.` });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'خطا در ذخیره تصویر';
    return res.status(500).json({ success: false, message });
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
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
  }

  const verification = verifyAccessToken(token);
  if (!verification.valid || !verification.decoded) {
    return res.status(401).json({ success: false, message: 'نشست شما معتبر نیست یا منقضی شده است.' });
  }

  const callerUser = await getEnrichedCallerUser(verification.decoded);
  const { isAuthorizedForMonitoring } = await import('../config/monitoringAccess');
  const lvl = Number(callerUser?.level);
  if (!isAuthorizedForMonitoring(callerUser) && lvl !== 1 && lvl !== 2) {
    return res.status(403).json({ success: false, message: 'مشاهده گزارش‌های خطا فقط برای مدیران سامانه مجاز است.' });
  }

  try {
    const items = await serverQueryCollection('bug_reports', callerUser);
    return res.json({ success: true, items });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'خطا در دریافت گزارش‌ها';
    return res.status(500).json({ success: false, message });
  }
});

// ===================== REALTIME SSE SYNC ENDPOINTS =====================

// GET /api/sync/events
router.get('/sync/events', async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
  }

  const verification = verifyAccessToken(token);
  if (!verification.valid) {
    return res.status(401).json({ success: false, message: 'نشست شما منقضی شده است.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  // Send immediate connected handshake to keep client healthy
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: Date.now() })}\n\n`);

  const { registerRealtimeListener } = await import('../lib/serverDataApi');
  const unsubscribe = registerRealtimeListener((event) => {
    try {
      res.write(`event: data_change\ndata: ${JSON.stringify(event)}\n\n`);
    } catch (e) {}
  });

  // Heartbeat comment every 15 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (e) {}
  }, 15000);

  req.on('close', () => {
    unsubscribe();
    clearInterval(heartbeat);
  });
});

// GET /api/sync/changes - High-efficiency delta polling endpoint
router.get('/sync/changes', async (req: Request, res: Response) => {
  const { getRecentChangesSince } = await import('../lib/serverDataApi');
  const { getForceReloadVersion } = await import('../lib/databaseAbstraction');
  const since = Number(req.query.since) || 0;
  const changes = getRecentChangesSince(since);
  const forceReloadVersion = await getForceReloadVersion();
  return res.json({ success: true, changes, serverTime: Date.now(), forceReloadVersion });
});

export default router;
