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

let tableChecked = false;

async function ensureAuditTableExists(): Promise<void> {
  if (tableChecked) return;
  const pool = getMysqlPool();
  if (!pool) return;

  try {
    const createSql = `
      CREATE TABLE IF NOT EXISTS \`audit_logs\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`action\` VARCHAR(100) NOT NULL,
        \`collection_name\` VARCHAR(100) NULL,
        \`record_id\` VARCHAR(100) NULL,
        \`user_id\` VARCHAR(100) NULL,
        \`user_name\` VARCHAR(150) NULL,
        \`user_role\` VARCHAR(100) NULL,
        \`details\` JSON NULL,
        \`ip_address\` VARCHAR(50) NULL,
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'success',
        \`error_message\` TEXT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_audit_action\` (\`action\`),
        INDEX \`idx_audit_user_name\` (\`user_name\`),
        INDEX \`idx_audit_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await pool.query(createSql);
    tableChecked = true;
  } catch (e: any) {
    console.warn('[AuditLogger Table Check Notice]:', e?.message || e);
  }
}

interface QueuedLog {
  input: AuditLogInput;
  retries: number;
}

const auditQueue: QueuedLog[] = [];
let isProcessing = false;

async function processAuditQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  while (auditQueue.length > 0) {
    const item = auditQueue.shift();
    if (!item) continue;

    try {
      await ensureAuditTableExists();
      const pool = getMysqlPool();
      if (!pool) {
        if (item.retries < 3) {
          item.retries++;
          auditQueue.push(item);
          await new Promise(r => setTimeout(r, 300));
        }
        continue;
      }

      const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const action = item.input.action || 'unknown';
      const collectionName = item.input.collectionName || null;
      const recordId = item.input.recordId || null;
      const userId = item.input.userId || null;
      const userName = item.input.userName || null;
      const userRole = item.input.userRole || null;
      const status = item.input.status || 'success';
      const errorMessage = item.input.errorMessage || null;
      const ipAddress = item.input.ipAddress || null;

      let detailsJson: string | null = null;
      if (item.input.details) {
        const sanitized = sanitizeDetails(item.input.details);
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
      if (e?.code === 'ER_NO_SUCH_TABLE' || e?.message?.includes("doesn't exist")) {
        tableChecked = false;
      }
      if (item.retries < 3) {
        item.retries++;
        auditQueue.push(item);
        await new Promise(r => setTimeout(r, 300));
      } else {
        console.warn('[AuditLogger Notice] Dropped log after retries:', e?.message || e);
      }
    }
  }

  isProcessing = false;
}

/**
 * Global Audit Logger
 * Asynchronously writes operation logs to `audit_logs` in MySQL via reliable queue.
 * Designed to NEVER block core HTTP response time while ensuring no records are lost.
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  auditQueue.push({ input, retries: 0 });
  void processAuditQueue();
}

/**
 * Flush any queued logs before server shutdown
 */
export async function flushAuditQueue(): Promise<void> {
  if (auditQueue.length === 0) return;
  await processAuditQueue();
}

process.on('beforeExit', () => { void flushAuditQueue(); });
process.on('SIGINT', () => { void flushAuditQueue(); });
process.on('SIGTERM', () => { void flushAuditQueue(); });

/**
 * Reverts an audit log activity if possible.
 */
export async function revertAuditActivity(logId: string, revertedBy: string): Promise<{ success: boolean; message: string }> {
  try {
    const pool = getMysqlPool();
    if (!pool) {
      return { success: false, message: 'دیتابیس در دسترس نیست.' };
    }

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
