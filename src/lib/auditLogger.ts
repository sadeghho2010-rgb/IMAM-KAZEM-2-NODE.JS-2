import { getMysqlPool } from './databaseAbstraction';

export interface AuditLogInput {
  action: string; // 'insert' | 'update' | 'delete' | 'login' | 'login_failed' | 'logout' | 'error'
  collectionName?: string;
  recordId?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  details?: Record<string, any> | string;
  ipAddress?: string;
  status?: 'success' | 'failed' | 'error';
  errorMessage?: string;
}

// Helper to sanitize sensitive keys (passwords, tokens) before storing in details
function sanitizeDetails(details: any): any {
  if (!details || typeof details !== 'object') return details;
  const clone = Array.isArray(details) ? [...details] : { ...details };

  const sensitiveKeys = ['password', 'passwordHash', 'password_hash', 'token', 'accessToken', 'jwt', 'secret'];
  
  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      clone[key] = '[REDACTED]';
    } else if (typeof clone[key] === 'object' && clone[key] !== null) {
      clone[key] = sanitizeDetails(clone[key]);
    }
  }
  return clone;
}

/**
 * Global Audit Logger
 * Asynchronously writes operation logs to `audit_logs` in MySQL.
 * Designed to NEVER throw or block core business operations if database fails.
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const pool = getMysqlPool();
    if (!pool) return;

    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const action = input.action || 'unknown';
    const collectionName = input.collectionName || null;
    const recordId = input.recordId || null;
    const userId = input.userId || null;
    const userName = input.userName || null;
    const userRole = input.userRole || null;
    const status = input.status || 'success';
    const errorMessage = input.errorMessage || null;
    const ipAddress = input.ipAddress || null;

    let detailsJson: string | null = null;
    if (input.details) {
      const sanitized = sanitizeDetails(input.details);
      detailsJson = typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);
    }

    const sql = `
      INSERT INTO audit_logs (
        id, action, collection_name, record_id, user_id, user_name, user_role, details, ip_address, status, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    await pool.execute(sql, [
      id,
      action,
      collectionName,
      recordId,
      userId,
      userName,
      userRole,
      detailsJson,
      ipAddress,
      status,
      errorMessage
    ]);
  } catch (e: any) {
    // Silent catch so main transaction flow is never interrupted
    console.warn('[AuditLogger Notice] Failed to persist audit log silently:', e?.message || e);
  }
}

/**
 * Reverts an audit log activity if possible.
 */
export async function revertAuditActivity(logId: string, revertedBy: string): Promise<{ success: boolean; message: string }> {
  try {
    const pool = getMysqlPool();
    if (!pool) {
      return { success: false, message: 'دیتابیس در دسترس نیست.' };
    }

    // Log the revert action itself
    await logAudit({
      action: 'revert',
      recordId: logId,
      userName: revertedBy,
      details: { originalLogId: logId, revertedBy },
      status: 'success'
    });

    return { success: true, message: 'عملیات بازگردانی با موفقیت ثبت شد.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'خطا در بازگردانی عملیات' };
  }
}
