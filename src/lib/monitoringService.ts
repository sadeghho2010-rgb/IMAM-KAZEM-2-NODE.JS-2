/**
 * Monitoring Repository & Service
 * Lightweight, non-blocking recording and retention management.
 * Guarantees zero system freeze or memory ballooning.
 */

import { getMysqlPool } from './databaseAbstraction';
import { monitoringConfig } from '../config/monitoringConfig';
import { 
  sanitizeSensitiveText, 
  sanitizeStackTrace, 
  computeFingerprint, 
  resolveSectionName 
} from './monitoringSanitizer';

export interface MonitoringEventInput {
  eventType: 'server_error' | 'client_error' | 'chunk_load_failed' | 'slow_request' | 'slow_query' | 'failed_login' | 'db_save_failure';
  severity?: 'info' | 'warn' | 'error' | 'critical';
  sectionName?: string;
  routePath?: string;
  statusCode?: number;
  durationMs?: number;
  requestId?: string;
  userId?: string;
  userRole?: string;
  displayName?: string;
  shortMessage: string;
  stack?: string;
  appVersion?: string;
  metadata?: any;
}

// In-memory debounce cache to prevent duplicate flood inside 60s
const recentFingerprints = new Map<string, number>();

// In-memory queue to ensure async non-blocking insertion
const insertQueue: any[] = [];
let isQueueProcessing = false;

/**
 * Initializes mon_tables in MySQL if they do not exist
 */
export async function initMonitoringDatabase(): Promise<void> {
  const pool = getMysqlPool();
  if (!pool) return;

  try {
    // 1. mon_events table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`mon_events\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`event_type\` VARCHAR(40) NOT NULL,
        \`severity\` VARCHAR(20) NOT NULL DEFAULT 'error',
        \`fingerprint\` VARCHAR(64) NOT NULL,
        \`section_name\` VARCHAR(100) NOT NULL,
        \`route_path\` VARCHAR(255) NULL,
        \`status_code\` INT NULL,
        \`duration_ms\` INT NULL,
        \`request_id\` VARCHAR(16) NULL,
        \`user_id\` VARCHAR(64) NULL,
        \`user_role\` VARCHAR(50) NULL,
        \`display_name\` VARCHAR(100) NULL,
        \`short_message\` VARCHAR(500) NOT NULL,
        \`short_stack\` TEXT NULL,
        \`app_version\` VARCHAR(20) NOT NULL DEFAULT '1.0.0',
        \`metadata_json\` VARCHAR(1500) NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_mon_time\` (\`created_at\`),
        INDEX \`idx_mon_fp_time\` (\`fingerprint\`, \`created_at\`),
        INDEX \`idx_mon_user_time\` (\`user_id\`, \`created_at\`),
        INDEX \`idx_mon_req_id\` (\`request_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. mon_issue_groups table (for issue status management in tab)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`mon_issue_groups\` (
        \`fingerprint\` VARCHAR(64) NOT NULL,
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'open',
        \`category\` VARCHAR(50) NOT NULL DEFAULT 'خطای سیستم',
        \`first_seen_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`last_seen_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`total_occurrences\` INT NOT NULL DEFAULT 1,
        \`resolution_note\` VARCHAR(255) NULL,
        \`reopened_count\` INT NOT NULL DEFAULT 0,
        PRIMARY KEY (\`fingerprint\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (err: any) {
    console.warn('[Monitoring DB Init Warning]:', err?.message || err);
  }
}

/**
 * Records a monitoring event safely and asynchronously
 */
export function recordMonitoringEvent(input: MonitoringEventInput): void {
  try {
    const pool = getMysqlPool();
    if (!pool) return;

    const routePath = input.routePath || '';
    
    // Check noise filter
    if (monitoringConfig.noisePaths.some(p => routePath.startsWith(p)) && (input.statusCode || 200) < 500) {
      return;
    }

    const shortMessage = sanitizeSensitiveText(input.shortMessage, monitoringConfig.maxShortMessageLength);
    const sectionName = input.sectionName || resolveSectionName(routePath);
    const fingerprint = computeFingerprint(input.eventType, shortMessage, sectionName);

    // Apply 60s debounce on identical fingerprints to prevent DB flooding
    const now = Date.now();
    const lastSeen = recentFingerprints.get(fingerprint);
    if (lastSeen && (now - lastSeen) < monitoringConfig.clientEventDebounceMs) {
      return;
    }
    recentFingerprints.set(fingerprint, now);

    // Prune debounce cache periodically
    if (recentFingerprints.size > 2000) {
      for (const [fp, time] of recentFingerprints.entries()) {
        if (now - time > 120000) recentFingerprints.delete(fp);
      }
    }

    const shortStack = input.stack ? sanitizeStackTrace(input.stack, monitoringConfig.maxStackLines) : null;
    let metadataStr: string | null = null;
    if (input.metadata) {
      try {
        const sanitizedMeta = sanitizeSensitiveText(JSON.stringify(input.metadata), monitoringConfig.maxMetadataBytes);
        metadataStr = sanitizedMeta;
      } catch {}
    }

    insertQueue.push({
      eventType: input.eventType,
      severity: input.severity || 'error',
      fingerprint,
      sectionName,
      routePath: routePath.substring(0, 250),
      statusCode: input.statusCode || null,
      durationMs: input.durationMs || null,
      requestId: input.requestId || null,
      userId: input.userId || null,
      userRole: input.userRole || null,
      displayName: sanitizeSensitiveText(input.displayName || '', 80) || null,
      shortMessage,
      shortStack,
      appVersion: input.appVersion || '1.0.0',
      metadataStr
    });

    // Fire non-blocking queue drain
    if (!isQueueProcessing) {
      void drainInsertQueue();
    }
  } catch (err) {
    // Fail-safe: monitoring must NEVER crash the app
    console.warn('[Monitoring Record Non-fatal Error]:', err);
  }
}

async function drainInsertQueue() {
  if (isQueueProcessing || insertQueue.length === 0) return;
  isQueueProcessing = true;

  const pool = getMysqlPool();
  if (!pool) {
    insertQueue.length = 0;
    isQueueProcessing = false;
    return;
  }

  try {
    while (insertQueue.length > 0) {
      const batch = insertQueue.splice(0, 20); // Process up to 20 at a time
      for (const item of batch) {
        await pool.query(`
          INSERT INTO \`mon_events\` (
            \`event_type\`, \`severity\`, \`fingerprint\`, \`section_name\`,
            \`route_path\`, \`status_code\`, \`duration_ms\`, \`request_id\`,
            \`user_id\`, \`user_role\`, \`display_name\`, \`short_message\`,
            \`short_stack\`, \`app_version\`, \`metadata_json\`
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          item.eventType, item.severity, item.fingerprint, item.sectionName,
          item.routePath, item.statusCode, item.durationMs, item.requestId,
          item.userId, item.userRole, item.displayName, item.shortMessage,
          item.shortStack, item.appVersion, item.metadataStr
        ]).catch(() => {});

        // Upsert issue group summary
        await pool.query(`
          INSERT INTO \`mon_issue_groups\` (
            \`fingerprint\`, \`status\`, \`category\`, \`first_seen_at\`, \`last_seen_at\`, \`total_occurrences\`
          ) VALUES (?, 'open', ?, NOW(), NOW(), 1)
          ON DUPLICATE KEY UPDATE 
            \`last_seen_at\` = NOW(),
            \`total_occurrences\` = \`total_occurrences\` + 1,
            \`status\` = IF(\`status\` = 'resolved', 'open', \`status\`),
            \`reopened_count\` = IF(\`status\` = 'resolved', \`reopened_count\` + 1, \`reopened_count\`)
        `, [item.fingerprint, item.eventType]).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('[Monitoring Queue Drain Warning]:', e);
  } finally {
    isQueueProcessing = false;
  }
}

/**
 * Enforces Retention (14 days & 20,000 rows max cap)
 * Keeps server disk clean and lightweight.
 */
export async function runMonitoringPurge(): Promise<{ deletedCount: number }> {
  const pool = getMysqlPool();
  if (!pool) return { deletedCount: 0 };

  let totalDeleted = 0;
  try {
    // 1. Delete events older than retentionDays
    const [retentionRes]: any = await pool.query(`
      DELETE FROM \`mon_events\` 
      WHERE \`created_at\` < DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [monitoringConfig.retentionDays]);
    totalDeleted += (retentionRes?.affectedRows || 0);

    // 2. Enforce absolute cap (maxTotalEvents) - remove oldest if exceeded
    const [countRes]: any = await pool.query(`SELECT COUNT(*) as total FROM \`mon_events\``);
    const currentCount = Number(countRes?.[0]?.total || 0);

    if (currentCount > monitoringConfig.maxTotalEvents) {
      const excess = currentCount - monitoringConfig.maxTotalEvents;
      const [capRes]: any = await pool.query(`
        DELETE FROM \`mon_events\` 
        ORDER BY \`id\` ASC 
        LIMIT ?
      `, [excess]);
      totalDeleted += (capRes?.affectedRows || 0);
    }
  } catch (err) {
    console.warn('[Monitoring Purge Error]:', err);
  }

  return { deletedCount: totalDeleted };
}

// Daily background retention timer
let purgeTimer: NodeJS.Timeout | null = null;
export function startMonitoringPurgeScheduler() {
  if (purgeTimer) clearInterval(purgeTimer);
  purgeTimer = setInterval(() => {
    void runMonitoringPurge();
  }, monitoringConfig.cleanupIntervalMs);

  if (purgeTimer.unref) purgeTimer.unref();
}
