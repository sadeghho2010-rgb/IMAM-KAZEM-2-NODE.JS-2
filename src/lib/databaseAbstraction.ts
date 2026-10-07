/**
 * Database Abstraction Layer (Repository Pattern & Dual-Engine Adapter)
 * Provides seamless interchangeability between MySQL (Primary Production Target)
 * and Supabase/Local JSON (Development Fallback).
 * 
 * Runflare Deploy Refresh Commit
 * Features:
 * - 100% Parameterized & Prepared Statements (Eliminating SQL Injection risks)
 * - Connection Pooling with auto-reconnect for MySQL 8+
 * - Unified CRUD interface for collections and domain entities
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { logSlowQuery, logServerError } from './systemHealthMonitor';

dotenv.config();

export function sanitizeRecordForDb(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeRecordForDb);
  
  const copy: any = {};
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val === undefined) continue;
    if (typeof val === 'string' && val.startsWith('data:image/') && val.length > 500000) {
      copy[key] = val.substring(0, 100) + '...[photo_truncated]';
      continue;
    }
    copy[key] = val;
  }
  return copy;
}

export interface SystemUserEntity {
  id: string;
  username: string;
  passwordHash?: string;
  name: string;
  role: string;
  level: number;
  roleTitle?: string;
  gradeLabel?: string;
  mentorId?: string;
  studentId?: string;
  linkedStudentId?: string;
  avatarBg?: string;
  allowedTabs?: string[];
  editableTabs?: string[];
  modulePermissions?: Record<string, string>;
  isActive?: boolean;
  mustChangePassword?: boolean;
  failedLoginAttempts?: number;
  accountLockedUntil?: string;
  lastLogin?: string;
  data?: any;
}

export interface AuditLogEntity {
  id?: string;
  userId?: string;
  username?: string;
  userRole?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  description: string;
  ipAddress?: string;
  createdAt?: string;
}

// Check if MySQL connection credentials are provided
export function parseMysqlConfig() {
  const env = process.env;
  let host = '';
  let port = Number(env.MYSQL_PORT || env.MYSQLPORT || env.DB_PORT) || 3306;
  let user = env.MYSQL_USER || env.MYSQLUSER || env.DB_USER || env.DB_USERNAME || '';
  let password = env.MYSQL_PASSWORD || env.MYSQLPASSWORD || env.DB_PASSWORD || env.DB_PASS || '';
  let database = env.MYSQL_DATABASE || env.MYSQLDATABASE || env.DB_DATABASE || env.DB_NAME || '';

  // Priority 1 & 2: DATABASE_URL / MYSQL_URL
  const connectionUrl = env.DATABASE_URL || env.MYSQL_URL || '';
  if (connectionUrl && (connectionUrl.startsWith('mysql://') || connectionUrl.startsWith('mysql2://'))) {
    try {
      const parsed = new URL(connectionUrl);
      host = parsed.hostname || '';
      if (parsed.port) port = Number(parsed.port) || 3306;
      if (parsed.username) user = decodeURIComponent(parsed.username);
      if (parsed.password) password = decodeURIComponent(parsed.password);
      if (parsed.pathname) database = parsed.pathname.replace(/^\//, '') || database;
    } catch (e) {
      console.error('[MySQL Config] Error parsing DATABASE_URL / MYSQL_URL:', e);
    }
  }

  // Priority 3 & 4: DB_HOST / MYSQL_HOST
  if (!host) {
    host = env.DB_HOST || env.MYSQL_HOST || env.MYSQLHOST || env.DB_HOSTNAME || '';
  }

  const isConfigured = Boolean(host && database);
  return { isConfigured, host, port, user, password, database };
}

export const isMysqlConfigured = Boolean(
  process.env.DATABASE_URL ||
  process.env.MYSQL_URL ||
  process.env.DB_HOST ||
  process.env.MYSQL_HOST ||
  process.env.MYSQLHOST ||
  process.env.DB_HOSTNAME
);

// Connection Status and Diagnostic Tracking
let pool: mysql.Pool | null = null;
let hasEnsuredIndexes = false;
let lastConnectionError: string | null = null;
let isCurrentlyConnected = false;

export function getDbConnectionStatus() {
  const conf = parseMysqlConfig();
  return {
    connected: isCurrentlyConnected,
    host: conf.host || '',
    port: conf.port || 3306,
    database: conf.database || '',
    user: conf.user || '',
    lastError: lastConnectionError
  };
}

export function translateMysqlError(err: any): string {
  const code = err?.code || '';
  const message = err?.message || String(err);
  
  if (code === 'ENOTFOUND' || message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
    return 'خطا: آدرس دیتابیس پیدا نشد. مقدار DB_HOST را چک کنید.';
  }
  if (code === 'ER_ACCESS_DENIED_ERROR' || err?.errno === 1045 || message.includes('Access denied')) {
    return 'خطا: نام کاربری یا رمز دیتابیس اشتباه است.';
  }
  if (code === 'ECONNREFUSED' || message.includes('ECONNREFUSED')) {
    return 'خطا: دیتابیس در دسترس نیست.';
  }
  if (code === 'ETIMEDOUT' || message.includes('ETIMEDOUT') || message.includes('timeout')) {
    return 'خطا: زمان اتصال به دیتابیس تمام شد.';
  }
  
  return `خطا در ارتباط با دیتابیس MySQL: ${message}`;
}

export function validateMysqlConfig(): { isValid: boolean; errors: string[] } {
  const conf = parseMysqlConfig();
  const errors: string[] = [];

  if (!conf.host) {
    errors.push('[MySQL Config Error] DB_HOST is empty or invalid');
  } else {
    const hostPattern = /^[a-zA-Z0-9.\-_]+$/;
    if (!hostPattern.test(conf.host)) {
      errors.push(`[MySQL Config Error] DB_HOST "${conf.host}" contains invalid characters`);
    }
  }

  if (!conf.port || isNaN(conf.port) || conf.port < 1 || conf.port > 65535) {
    errors.push(`[MySQL Config Error] DB_PORT "${conf.port}" is invalid (must be between 1 and 65535)`);
  }

  if (!conf.database) {
    errors.push('[MySQL Config Error] DB_DATABASE is not set');
  }

  if (!conf.user) {
    errors.push('[MySQL Config Error] DB_USERNAME is not set');
  }

  if (!conf.password) {
    errors.push('[MySQL Config Error] DB_PASSWORD is not set');
  }

  const isValid = errors.length === 0;
  if (!isValid) {
    errors.forEach(err => console.error(err));
  }
  return { isValid, errors };
}

export async function testMysqlConnection(): Promise<boolean> {
  const mysqlPool = getMysqlPool();
  if (!mysqlPool) {
    isCurrentlyConnected = false;
    if (!lastConnectionError) {
      lastConnectionError = 'MySQL is not configured or configuration validation failed.';
    }
    return false;
  }

  try {
    const connection = await mysqlPool.getConnection();
    await connection.ping();
    connection.release();
    isCurrentlyConnected = true;
    lastConnectionError = null;
    return true;
  } catch (err: any) {
    isCurrentlyConnected = false;
    lastConnectionError = translateMysqlError(err);
    console.error(`[MySQL Connection Test Failed]: ${lastConnectionError}`);
    return false;
  }
}

export async function ensurePerformanceIndexes(p?: mysql.Pool): Promise<void> {
  const mysqlPool = p || getMysqlPool();
  if (!mysqlPool) return;
  if (hasEnsuredIndexes) return;
  hasEnsuredIndexes = true;

  // 1. Ensure app_collections table exists
  try {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`app_collections\` (
        \`collection_name\` VARCHAR(100) NOT NULL,
        \`id\` VARCHAR(100) NOT NULL,
        \`data\` JSON NOT NULL,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`collection_name\`, \`id\`),
        INDEX \`idx_collection_updated\` (\`collection_name\`, \`updated_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e: any) {
    console.warn('[MySQL Schema Notice - app_collections]:', e?.message || e);
  }

  // 2. Ensure system_users table exists
  try {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`system_users\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`username\` VARCHAR(100) NOT NULL,
        \`password_hash\` VARCHAR(255) NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`role\` VARCHAR(50) NOT NULL DEFAULT 'student',
        \`role_title\` VARCHAR(100) NULL,
        \`avatar_url\` VARCHAR(500) NULL,
        \`level\` INT NOT NULL DEFAULT 3,
        \`grade_label\` VARCHAR(100) NULL,
        \`mentor_id\` VARCHAR(100) NULL,
        \`student_id\` VARCHAR(100) NULL,
        \`linked_student_id\` VARCHAR(100) NULL,
        \`avatar_bg\` VARCHAR(50) NULL,
        \`allowed_tabs\` JSON NULL,
        \`editable_tabs\` JSON NULL,
        \`module_permissions\` JSON NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`must_change_password\` TINYINT(1) NOT NULL DEFAULT 0,
        \`failed_login_attempts\` INT NOT NULL DEFAULT 0,
        \`account_locked_until\` DATETIME NULL,
        \`last_login\` DATETIME NULL,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_username\` (\`username\`),
        INDEX \`idx_users_role_level\` (\`role\`, \`level\`),
        INDEX \`idx_users_active\` (\`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e: any) {
    console.warn('[MySQL Schema Notice - system_users]:', e?.message || e);
  }

  try {
    await mysqlPool.query(`ALTER TABLE system_users ADD COLUMN IF NOT EXISTS role_title VARCHAR(100) NULL`);
  } catch (e: any) {
    try { await mysqlPool.query(`ALTER TABLE system_users ADD COLUMN role_title VARCHAR(100) NULL`); } catch (err) {}
  }
  try {
    await mysqlPool.query(`ALTER TABLE system_users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) NULL`);
  } catch (e: any) {
    try { await mysqlPool.query(`ALTER TABLE system_users ADD COLUMN avatar_url VARCHAR(500) NULL`); } catch (err) {}
  }

  // Ensure login_audit_log table exists
  try {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`login_audit_log\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`username\` VARCHAR(150) NOT NULL,
        \`success\` TINYINT(1) NOT NULL,
        \`ip_address\` VARCHAR(50) NOT NULL,
        \`user_agent\` VARCHAR(500) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_login_username\` (\`username\`),
        INDEX \`idx_login_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e: any) {
    console.warn('[MySQL Schema Notice - login_audit_log]:', e?.message || e);
  }

  // 3. Ensure students table exists
  try {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`students\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`student_code\` VARCHAR(50) NULL,
        \`national_id\` VARCHAR(20) NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`father_name\` VARCHAR(150) NULL,
        \`grade\` VARCHAR(100) NOT NULL,
        \`phone\` VARCHAR(50) NULL,
        \`address\` TEXT NULL,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'active',
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`entry_year\` VARCHAR(10) NULL,
        \`mentor_id\` VARCHAR(100) NULL,
        \`notes\` TEXT NULL,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_student_national_id\` (\`national_id\`),
        INDEX \`idx_student_grade\` (\`grade\`),
        INDEX \`idx_student_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e: any) {
    console.warn('[MySQL Schema Notice - students]:', e?.message || e);
  }

  // 4. Ensure classrooms table exists
  try {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`classrooms\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`title\` VARCHAR(200) NOT NULL,
        \`grade\` VARCHAR(100) NULL,
        \`capacity\` INT NOT NULL DEFAULT 20,
        \`location\` VARCHAR(255) NULL,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e: any) {
    console.warn('[MySQL Schema Notice - classrooms]:', e?.message || e);
  }

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`teachers\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`specialty\` VARCHAR(255) NULL,
        \`phone\` VARCHAR(50) NULL,
        \`email\` VARCHAR(150) NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_teacher_active\` (\`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`classrooms\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`title\` VARCHAR(200) NOT NULL,
        \`grade\` VARCHAR(100) NULL,
        \`capacity\` INT NOT NULL DEFAULT 20,
        \`location\` VARCHAR(255) NULL,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`programs\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`grade\` VARCHAR(100) NOT NULL,
        \`teacher_id\` VARCHAR(100) NULL,
        \`teacher_name\` VARCHAR(255) NULL,
        \`classroom_id\` VARCHAR(100) NULL,
        \`day_of_week\` VARCHAR(50) NULL,
        \`start_time\` VARCHAR(20) NULL,
        \`end_time\` VARCHAR(20) NULL,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_programs_grade\` (\`grade\`),
        INDEX \`idx_programs_teacher\` (\`teacher_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`enrollments\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`student_id\` VARCHAR(100) NOT NULL,
        \`program_id\` VARCHAR(100) NOT NULL,
        \`grade\` VARCHAR(100) NULL,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'enrolled',
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_enrollment_program\` (\`program_id\`),
        INDEX \`idx_enrollment_student\` (\`student_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`attendance\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`student_id\` VARCHAR(100) NOT NULL,
        \`date\` VARCHAR(30) NOT NULL,
        \`program_id\` VARCHAR(100) NULL,
        \`status\` VARCHAR(30) NOT NULL DEFAULT 'present',
        \`minutes_late\` INT NOT NULL DEFAULT 0,
        \`reason\` TEXT NULL,
        \`recorded_by\` VARCHAR(100) NULL,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_attendance_student_date\` (\`student_id\`, \`date\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`student_requests\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`student_id\` VARCHAR(100) NOT NULL,
        \`student_name\` VARCHAR(150) NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`category\` VARCHAR(100) NOT NULL DEFAULT 'educational',
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'pending',
        \`description\` TEXT NULL,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_request_student\` (\`student_id\`),
        INDEX \`idx_request_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`audit_logs\` (
          \`id\` VARCHAR(100) NOT NULL,
          \`action\` VARCHAR(50) NOT NULL,
          \`collection_name\` VARCHAR(100) NULL,
          \`record_id\` VARCHAR(100) NULL,
          \`user_id\` VARCHAR(100) NULL,
          \`user_name\` VARCHAR(150) NULL,
          \`user_role\` VARCHAR(100) NULL,
          \`details\` JSON NULL,
          \`ip_address\` VARCHAR(60) NULL,
          \`status\` VARCHAR(20) NOT NULL DEFAULT 'success',
          \`error_message\` TEXT NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          INDEX \`idx_audit_action\` (\`action\`),
          INDEX \`idx_audit_collection\` (\`collection_name\`),
          INDEX \`idx_audit_user\` (\`user_id\`),
          INDEX \`idx_audit_date\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Column migrations for existing audit_logs table
      const alterCols = [
        'ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS collection_name VARCHAR(100) NULL',
        'ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS record_id VARCHAR(100) NULL',
        'ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_name VARCHAR(150) NULL',
        'ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT "success"',
        'ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS error_message TEXT NULL',
        'ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSON NULL'
      ];
      for (const colSql of alterCols) {
        try { await mysqlPool.query(colSql); } catch (e) {}
      }
    } catch (e: any) {
      console.warn('[MySQL Schema Notice - audit_logs]:', e?.message || e);
    }

    try {
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`audit_chain_logs\` (
          \`id\` VARCHAR(100) NOT NULL,
          \`sequence\` BIGINT NOT NULL AUTO_INCREMENT,
          \`prev_hash\` VARCHAR(255) NOT NULL,
          \`hash\` VARCHAR(255) NOT NULL,
          \`action\` VARCHAR(100) NOT NULL,
          \`user_id\` VARCHAR(100) NULL,
          \`username\` VARCHAR(100) NULL,
          \`details\` JSON NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`sequence\`),
          UNIQUE KEY \`uk_chain_id\` (\`id\`),
          INDEX \`idx_chain_hash\` (\`hash\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } catch (e: any) {
      console.warn('[MySQL Schema Notice - audit_chain_logs]:', e?.message || e);
    }

    const indexes = [
      { table: 'app_collections', name: 'idx_col_name_updated', cols: '`collection_name`, `updated_at`' }
    ];

  for (const idx of indexes) {
    const label = `${idx.table}.${idx.name}`;
    try {
      const [rows]: any = await mysqlPool.query(
        `SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
        [idx.table, idx.name]
      );
      if (rows && rows.length > 0) {
        console.log(`[MySQL Index] ${label}: از قبل وجود داشت`);
      } else {
        await mysqlPool.query(`CREATE INDEX \`${idx.name}\` ON \`${idx.table}\` (${idx.cols})`);
        console.log(`[MySQL Index] ${label}: ساخته شد`);
      }
    } catch (e: any) {
      const errCode = e?.errno || e?.code;
      const errMsg = e?.message || String(e);
      if (errCode === 1142 || errCode === 1044 || errMsg.toLowerCase().includes('command denied') || errMsg.toLowerCase().includes('access denied')) {
        console.warn(`[MySQL Index] ${label}: خطا: عدم دسترسی لازم (کاربر دیتابیس مجوز ایجاد ایندکس INDEX privilege را ندارد)`);
      } else {
        console.warn(`[MySQL Index] ${label}: خطا: ${errMsg}`);
      }
    }
  }
}

export function getMysqlPool(): mysql.Pool | null {
  const { isValid, errors } = validateMysqlConfig();
  if (!isValid) {
    lastConnectionError = errors.join(' | ');
    return null;
  }

  const conf = parseMysqlConfig();

  if (!pool) {
    try {
      console.log(`==================================================`);
      console.log(`[MySQL Connection Attempt]`);
      console.log(` - Host: "${conf.host}"`);
      console.log(` - Port: ${conf.port}`);
      console.log(` - Database: "${conf.database}"`);
      console.log(` - User: "${conf.user}"`);
      console.log(` - Password Length: ${conf.password ? conf.password.length : 0} chars`);
      console.log(` - Source Priority: DATABASE_URL -> MYSQL_URL -> DB_HOST -> MYSQL_HOST`);
      console.log(`==================================================`);

      pool = mysql.createPool({
        host: conf.host,
        port: conf.port,
        user: conf.user,
        password: conf.password,
        database: conf.database,
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 50,
        charset: 'utf8mb4_unicode_ci',
        timezone: '+03:30' // Iran Standard Time
      });

      console.log(`[MySQL Engine] Connection pool successfully initialized for database "${conf.database}" on "${conf.host}:${conf.port}"`);
    } catch (err: any) {
      const errMsg = translateMysqlError(err);
      console.error('[MySQL Engine] Pool initialization error:', errMsg, err);
      lastConnectionError = errMsg;
      pool = null;
    }
  }
  return pool;
}

/**
 * Executes a prepared query safely on MySQL with parameters
 */
export async function executeMysqlQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  // If connection is not active, try to re-test/re-connect automatically
  if (!isCurrentlyConnected) {
    await testMysqlConnection();
  }

  const mysqlPool = getMysqlPool();
  if (!mysqlPool) {
    throw new Error('خطا: ارتباط با سرور دیتابیس برقرار نشد. لطفاً تنظیمات پایگاه داده را بررسی کنید.');
  }

  const startTime = Date.now();
  try {
    const [rows] = await mysqlPool.execute(sql, params);
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      logSlowQuery('MySQL Query', duration, sql);
    }
    // Connection successful
    isCurrentlyConnected = true;
    return rows as T[];
  } catch (err: any) {
    logServerError(err.message, err.stack, 'executeMysqlQuery');
    console.error('[MySQL Execution Error]:', err.message, '\nQuery:', sql);
    
    // Check if error is a connection issue to log status
    const translatedMessage = translateMysqlError(err);
    isCurrentlyConnected = false;
    lastConnectionError = translatedMessage;
    
    throw new Error(translatedMessage);
  }
}

/**
 * Universal repository methods for MySQL
 */
export const MysqlRepository = {
  // 1. Fetch User by Username
  async findUserByUsername(username: string): Promise<SystemUserEntity | null> {
    const pool = getMysqlPool();
    if (!pool) return null;

    try {
      const [rows]: any = await pool.execute(
        `SELECT id, username, password_hash AS passwordHash, name, role, role_title AS roleTitle,
                level, grade_label AS gradeLabel, mentor_id AS mentorId, student_id AS studentId,
                linked_student_id AS linkedStudentId, avatar_bg AS avatarBg,
                allowed_tabs AS allowedTabs, editable_tabs AS editableTabs, module_permissions AS modulePermissions,
                is_active AS isActive, must_change_password AS mustChangePassword,
                failed_login_attempts AS failedLoginAttempts, account_locked_until AS accountLockedUntil,
                last_login AS lastLogin, data
         FROM system_users
         WHERE UPPER(username) = UPPER(?) LIMIT 1`,
        [username]
      );

      if (rows && rows.length > 0) {
        const u = rows[0];
        return {
          ...u,
          allowedTabs: typeof u.allowedTabs === 'string' ? JSON.parse(u.allowedTabs) : u.allowedTabs || [],
          editableTabs: typeof u.editableTabs === 'string' ? JSON.parse(u.editableTabs) : u.editableTabs || [],
          modulePermissions: typeof u.modulePermissions === 'string' ? JSON.parse(u.modulePermissions) : u.modulePermissions || {},
          isActive: Boolean(u.isActive),
          mustChangePassword: Boolean(u.mustChangePassword)
        };
      }
      return null;
    } catch (e) {
      console.warn('[MySQL findUserByUsername Error]:', e);
      return null;
    }
  },

  // 2. Fetch All Users
  async getAllUsers(): Promise<SystemUserEntity[]> {
    const pool = getMysqlPool();
    if (!pool) return [];

    try {
      const [rows]: any = await pool.execute(
        `SELECT id, username, password_hash AS passwordHash, name, role, role_title AS roleTitle,
                level, grade_label AS gradeLabel, mentor_id AS mentorId, student_id AS studentId,
                linked_student_id AS linkedStudentId, avatar_bg AS avatarBg,
                allowed_tabs AS allowedTabs, editable_tabs AS editableTabs, module_permissions AS modulePermissions,
                is_active AS isActive, must_change_password AS mustChangePassword,
                failed_login_attempts AS failedLoginAttempts, account_locked_until AS accountLockedUntil,
                last_login AS lastLogin, data
         FROM system_users ORDER BY level ASC, name ASC`
      );

      return (rows || []).map((u: any) => ({
        ...u,
        allowedTabs: typeof u.allowedTabs === 'string' ? JSON.parse(u.allowedTabs) : u.allowedTabs || [],
        editableTabs: typeof u.editableTabs === 'string' ? JSON.parse(u.editableTabs) : u.editableTabs || [],
        modulePermissions: typeof u.modulePermissions === 'string' ? JSON.parse(u.modulePermissions) : u.modulePermissions || {},
        isActive: Boolean(u.isActive),
        mustChangePassword: Boolean(u.mustChangePassword)
      }));
    } catch (e) {
      console.warn('[MySQL getAllUsers Error]:', e);
      return [];
    }
  },

  // 3. Upsert User (Insert or Update with Prepared Statement)
  async saveUser(user: SystemUserEntity): Promise<void> {
    const pool = getMysqlPool();
    if (!pool) return;

    const sql = `
      INSERT INTO system_users (
        id, username, password_hash, name, role, role_title, level, grade_label,
        mentor_id, student_id, linked_student_id, avatar_bg, allowed_tabs,
        editable_tabs, module_permissions, is_active, must_change_password,
        failed_login_attempts, account_locked_until, last_login, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        password_hash = IF(VALUES(password_hash) IS NOT NULL AND VALUES(password_hash) != '', VALUES(password_hash), password_hash),
        role = VALUES(role),
        role_title = VALUES(role_title),
        level = VALUES(level),
        grade_label = VALUES(grade_label),
        mentor_id = VALUES(mentor_id),
        student_id = VALUES(student_id),
        linked_student_id = VALUES(linked_student_id),
        avatar_bg = VALUES(avatar_bg),
        allowed_tabs = VALUES(allowed_tabs),
        editable_tabs = VALUES(editable_tabs),
        module_permissions = VALUES(module_permissions),
        is_active = VALUES(is_active),
        must_change_password = VALUES(must_change_password),
        failed_login_attempts = VALUES(failed_login_attempts),
        account_locked_until = VALUES(account_locked_until),
        last_login = VALUES(last_login),
        data = VALUES(data),
        updated_at = NOW();
    `;

    const params = [
      user.id,
      user.username.toUpperCase(),
      user.passwordHash || null,
      user.name,
      user.role,
      user.roleTitle || null,
      user.level,
      user.gradeLabel || null,
      user.mentorId || null,
      user.studentId || null,
      user.linkedStudentId || null,
      user.avatarBg || null,
      JSON.stringify(user.allowedTabs || []),
      JSON.stringify(user.editableTabs || []),
      JSON.stringify(user.modulePermissions || {}),
      user.isActive !== false ? 1 : 0,
      user.mustChangePassword ? 1 : 0,
      user.failedLoginAttempts || 0,
      user.accountLockedUntil ? new Date(user.accountLockedUntil) : null,
      user.lastLogin ? new Date(user.lastLogin) : null,
      JSON.stringify(user.data || {})
    ];

    await pool.execute(sql, params);
  },

  // 4. Record Audit Log
  async recordAuditLog(log: AuditLogEntity): Promise<void> {
    const pool = getMysqlPool();
    if (!pool) return;

    try {
      const id = log.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await pool.execute(
        `INSERT INTO audit_logs (id, user_id, username, user_role, action, entity_type, entity_id, description, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          id,
          log.userId || null,
          log.username || null,
          log.userRole || null,
          log.action,
          log.entityType || null,
          log.entityId || null,
          log.description,
          log.ipAddress || null
        ]
      );
    } catch (e) {
      console.warn('[MySQL AuditLog Error]:', e);
    }
  },

  // 5. Save Document to App Collections or Dedicated Table
  async saveDocument(collectionName: string, id: string, data: any): Promise<{ affectedRows: number }> {
    const pool = getMysqlPool();
    if (!pool) {
      throw new Error('پایگاه داده MySQL پیکربندی نشده یا در دسترس نیست.');
    }

    const cleanData = sanitizeRecordForDb(data);
    const jsonStr = JSON.stringify(cleanData);

    const sql = `
      INSERT INTO app_collections (collection_name, id, data, updated_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        data = ?,
        updated_at = NOW();
    `;
    const [result]: any = await pool.execute(sql, [collectionName, id, jsonStr, jsonStr]);
    const affectedRows = Number(result?.affectedRows) || 0;

    console.log(`[MySQL Save Log] Collection: "${collectionName}", ID: "${id}", Affected Rows: ${affectedRows}`);
    if (affectedRows === 0) {
      console.warn(`[MySQL Save Warning] Collection: "${collectionName}", ID: "${id}" yielded 0 affected rows!`);
    }

    return { affectedRows };
  },

  // 5b. Save Document to Dedicated Table if it exists
  async saveToDedicatedTable(tableName: string, row: any): Promise<void> {
    const pool = getMysqlPool();
    if (!pool || !row || !row.id) return;

    try {
      if (tableName === 'students') {
        const sql = `
          INSERT INTO students (id, student_code, national_id, name, father_name, grade, phone, address, status, is_active, entry_year, mentor_id, notes, data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            student_code = VALUES(student_code),
            national_id = VALUES(national_id),
            name = VALUES(name),
            father_name = VALUES(father_name),
            grade = VALUES(grade),
            phone = VALUES(phone),
            address = VALUES(address),
            status = VALUES(status),
            is_active = VALUES(is_active),
            entry_year = VALUES(entry_year),
            mentor_id = VALUES(mentor_id),
            notes = VALUES(notes),
            data = VALUES(data),
            updated_at = NOW();
        `;
        await pool.execute(sql, [
          row.id,
          row.student_code || null,
          row.national_id || null,
          row.name || 'نامشخص',
          row.father_name || null,
          row.grade || 'نامشخص',
          row.phone || null,
          row.address || null,
          row.status || 'active',
          row.is_active !== undefined ? (row.is_active ? 1 : 0) : 1,
          row.entry_year || null,
          row.mentor_id || null,
          row.notes || null,
          JSON.stringify(row.data || {})
        ]);
      } else if (tableName === 'classrooms') {
        const sql = `
          INSERT INTO classrooms (id, title, grade, capacity, location, data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            grade = VALUES(grade),
            capacity = VALUES(capacity),
            location = VALUES(location),
            data = VALUES(data),
            updated_at = NOW();
        `;
        await pool.execute(sql, [
          row.id,
          row.title || 'کلاس بدون عنوان',
          row.grade || null,
          Number(row.capacity) || 20,
          row.location || null,
          JSON.stringify(row.data || {})
        ]);
      }
    } catch (e: any) {
      console.warn(`[MySQL Dedicated Table Notice] ${tableName}:`, e?.message || e);
    }
  },

  // 6. Delete Document
  async deleteDocument(collectionName: string, id: string): Promise<{ affectedRows: number }> {
    const pool = getMysqlPool();
    if (!pool) {
      throw new Error('MySQL connection pool is not configured or unavailable.');
    }

    const [result]: any = await pool.execute(
      `DELETE FROM app_collections WHERE collection_name = ? AND id = ?`,
      [collectionName, id]
    );
    const affectedRows = Number(result?.affectedRows) || 0;

    console.log(`[MySQL Delete Log] Collection: "${collectionName}", ID: "${id}", Affected Rows: ${affectedRows}`);

    if (collectionName === 'system_users') {
      try {
        await pool.execute(
          `DELETE FROM system_users WHERE id = ? OR UPPER(username) = UPPER(?)`,
          [id, id]
        );
      } catch (e) {}
    }

    return { affectedRows };
  },

  // 6b. Delete User
  async deleteUser(userIdOrUsername: string): Promise<void> {
    const pool = getMysqlPool();
    if (!pool) return;

    try {
      await pool.execute(
        `DELETE FROM system_users WHERE id = ? OR UPPER(username) = UPPER(?)`,
        [userIdOrUsername, userIdOrUsername]
      );
      await pool.execute(
        `DELETE FROM app_collections WHERE collection_name = 'system_users' AND (id = ? OR UPPER(id) = UPPER(?))`,
        [userIdOrUsername, userIdOrUsername]
      );
    } catch (e) {
      console.warn('[MySQL deleteUser Error]:', e);
    }
  },

  // 7. Get Single Document by Primary Key
  async getDocument(collectionName: string, id: string): Promise<any | null> {
    const pool = getMysqlPool();
    if (!pool) return null;

    const [rows]: any = await pool.execute(
      `SELECT data FROM app_collections WHERE collection_name = ? AND id = ? LIMIT 1`,
      [collectionName, id]
    );

    if (rows && rows.length > 0) {
      const r = rows[0];
      const parsed = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      return { ...parsed, id };
    }
    return null;
  },

  // 8. Get Multiple Documents by Candidate IDs (Primary Keys)
  async getDocumentsByIds(collectionName: string, ids: string[]): Promise<any[]> {
    if (!ids || ids.length === 0) return [];
    const pool = getMysqlPool();
    if (!pool) return [];

    const placeholders = ids.map(() => '?').join(', ');
    const [rows]: any = await pool.execute(
      `SELECT id, data FROM app_collections WHERE collection_name = ? AND id IN (${placeholders})`,
      [collectionName, ...ids]
    );

    return (rows || []).map((r: any) => {
      const parsed = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      return { ...parsed, id: r.id };
    });
  },

  // 9. Query Documents
  async queryCollection(collectionName: string): Promise<any[]> {
    const pool = getMysqlPool();
    if (!pool) return [];

    const startTime = Date.now();
    const [rows]: any = await pool.execute(
      `SELECT id, data FROM app_collections WHERE collection_name = ? ORDER BY updated_at DESC`,
      [collectionName]
    );
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      logSlowQuery(collectionName, duration, `SELECT id, data FROM app_collections WHERE collection_name = '${collectionName}' ORDER BY updated_at DESC`);
    }

    return (rows || []).map((r: any) => {
      const parsed = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      return { ...parsed, id: r.id };
    });
  }
};

export async function recordLoginAuditInDb(log: {
  username: string;
  success: boolean;
  ipAddress: string;
  userAgent?: string;
}): Promise<void> {
  const pool = getMysqlPool();
  if (!pool) return;
  try {
    const id = `login_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await pool.execute(
      `INSERT INTO login_audit_log (id, username, success, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
      [id, log.username.trim().toUpperCase(), log.success ? 1 : 0, log.ipAddress, log.userAgent || '']
    );
  } catch (err: any) {
    console.warn('[Login Audit DB Notice]:', err?.message || err);
  }
}
