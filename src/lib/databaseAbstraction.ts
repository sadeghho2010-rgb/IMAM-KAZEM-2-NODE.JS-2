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
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { logSlowQuery, logServerError } from './systemHealthMonitor';

dotenv.config();

export function parseGradeToNumericLevel(gradeInput: any): number {
  if (typeof gradeInput === 'number') return isNaN(gradeInput) ? 3 : gradeInput;
  if (!gradeInput || typeof gradeInput !== 'string') return 3;
  const englishDigits = gradeInput.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
  const match = englishDigits.match(/\d+/);
  if (match) {
    const parsed = parseInt(match[0], 10);
    return isNaN(parsed) ? 3 : parsed;
  }
  return 3;
}

export function cleanNullableStr(val: any): string | null {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  return str.length === 0 ? null : str;
}

export function mapDedicatedRowToRecord(collection: string, row: any): any {
  if (!row) return null;
  let record: any = {};
  if (row.data) {
    try {
      record = typeof row.data === 'string' ? JSON.parse(row.data) : { ...row.data };
    } catch (e) {
      record = {};
    }
  }

  record.id = row.id || record.id;

  if (collection === 'students') {
    if (row.name && row.name !== 'نامشخص') record.name = row.name;
    if (row.grade && row.grade !== 'نامشخص') record.grade = row.grade;
    if (row.national_id) {
      record.nationalId = row.national_id;
      record.national_id = row.national_id;
    }
    if (row.student_code) {
      record.studentCode = row.student_code;
      record.student_code = row.student_code;
    }
    if (row.phone) record.phone = row.phone;
    if (row.father_name) record.fatherName = row.father_name;
    if (row.is_active !== undefined && row.is_active !== null) {
      record.isActive = Boolean(row.is_active);
    }
    if (row.status) record.status = row.status;
    if (row.entry_year) record.entryYear = row.entry_year;
    if (row.mentor_id) record.mentorId = row.mentor_id;
    if (row.notes) record.notes = row.notes;
    if (row.created_at) record.createdAt = new Date(row.created_at).toISOString();
    if (row.updated_at) record.updatedAt = new Date(row.updated_at).toISOString();
  } else if (collection === 'classrooms' || collection === 'classes') {
    if (row.title && row.title !== 'کلاس بدون عنوان') record.title = row.title;
    if (row.grade && row.grade !== 'نامشخص') record.grade = row.grade;
    if (row.capacity) record.capacity = Number(row.capacity);
    if (row.location) record.location = row.location;
    if (row.created_at) record.createdAt = new Date(row.created_at).toISOString();
    if (row.updated_at) record.updatedAt = new Date(row.updated_at).toISOString();
  } else if (collection === 'programs') {
    if (row.title && row.title !== 'برنامه بدون عنوان') record.title = row.title;
    if (row.grade && row.grade !== 'نامشخص') record.grade = row.grade;
    if (row.type) record.type = row.type;
    if (row.parent_program_id !== undefined && row.parent_program_id !== null) {
      record.parentProgramId = row.parent_program_id || record.parentProgramId || '';
    }
    if (row.teacher_id) record.teacherId = row.teacher_id;
    if (row.teacher_name) {
      record.teacherName = row.teacher_name;
      record.teacher = row.teacher_name;
    }
    if (row.classroom_id) {
      record.classroomId = row.classroom_id;
      record.classroom = row.classroom_id;
      record.madrasRoom = row.classroom_id;
    }
    if (row.day_of_week) {
      record.day = row.day_of_week;
      if (!record.days || !Array.isArray(record.days) || record.days.length === 0) {
        record.days = row.day_of_week.split(' ، ').map((d: string) => d.trim()).filter(Boolean);
      }
    }
    if (row.start_time || row.end_time) {
      record.startTime = row.start_time || record.startTime || '';
      record.endTime = row.end_time || record.endTime || '';
      if (row.start_time && row.end_time) {
        record.time = `${row.start_time} الی ${row.end_time}`;
      }
    }
    if (row.representative_student_ids) {
      try {
        const parsed = typeof row.representative_student_ids === 'string'
          ? JSON.parse(row.representative_student_ids)
          : row.representative_student_ids;
        if (Array.isArray(parsed) && parsed.length > 0) record.representativeStudentIds = parsed;
      } catch (e) {}
    }
    if (row.representative_names) {
      try {
        const parsed = typeof row.representative_names === 'string'
          ? JSON.parse(row.representative_names)
          : row.representative_names;
        if (Array.isArray(parsed) && parsed.length > 0) record.representativeNames = parsed;
      } catch (e) {}
    }
    if (row.term) record.term = row.term;
    if (row.created_at) record.createdAt = new Date(row.created_at).toISOString();
    if (row.updated_at) record.updatedAt = new Date(row.updated_at).toISOString();
  } else if (collection === 'attendance') {
    if (row.student_id) record.studentId = row.student_id;
    if (row.date) record.date = row.date;
    if (row.program_id) record.programId = row.program_id;
    if (row.grade && row.grade !== 'نامشخص') record.grade = row.grade;
    if (row.present_count !== undefined && row.present_count !== null) record.presentCount = Number(row.present_count);
    if (row.absent_count !== undefined && row.absent_count !== null) record.absentCount = Number(row.absent_count);
    if (row.created_at) record.createdAt = new Date(row.created_at).toISOString();
    if (row.updated_at) record.updatedAt = new Date(row.updated_at).toISOString();
  } else if (collection === 'teachers') {
    if (row.name && row.name !== 'نامشخص') {
      record.name = row.name;
      record.fullName = row.name;
    }
    if (row.specialty) record.specialty = row.specialty;
    if (row.phone) {
      record.phone = row.phone;
      record.phoneNumber = row.phone;
    }
    if (row.email) record.email = row.email;
    if (row.is_active !== undefined && row.is_active !== null) record.isActive = Boolean(row.is_active);
    if (row.created_at) record.createdAt = new Date(row.created_at).toISOString();
    if (row.updated_at) record.updatedAt = new Date(row.updated_at).toISOString();
  } else if (collection === 'enrollments') {
    if (row.student_id) record.studentId = row.student_id;
    if (row.program_id) record.programId = row.program_id;
    if (row.grade && row.grade !== 'نامشخص') record.grade = row.grade;
    if (row.status) record.status = row.status;
    if (row.created_at) record.createdAt = new Date(row.created_at).toISOString();
    if (row.updated_at) record.updatedAt = new Date(row.updated_at).toISOString();
  } else if (collection === 'student_requests') {
    if (row.student_id) record.studentId = row.student_id;
    if (row.unit) record.unit = row.unit;
    if (row.type) record.type = row.type;
    if (row.status) record.status = row.status;
    if (row.created_at) record.createdAt = new Date(row.created_at).toISOString();
    if (row.updated_at) record.updatedAt = new Date(row.updated_at).toISOString();
  } else if (collection === 'system_users' || collection === 'all_users' || collection === 'users') {
    if (row.username) record.username = row.username;
    if (row.name) {
      record.name = row.name;
      record.fullName = row.name;
    }
    if (row.role) record.role = row.role;
    if (row.role_title) record.roleTitle = row.role_title;
    if (row.level !== undefined && row.level !== null) record.level = Number(row.level);
    if (row.grade_label) {
      record.gradeLabel = row.grade_label;
      record.grade = row.grade_label;
    }
    if (row.mentor_id) record.mentorId = row.mentor_id;
    if (row.student_id) record.studentId = row.student_id;
    if (row.linked_student_id) record.linkedStudentId = row.linked_student_id;
    if (row.teacher_id) record.teacherId = row.teacher_id;
    if (row.avatar_bg) record.avatarBg = row.avatar_bg;
    if (row.is_active !== undefined && row.is_active !== null) record.isActive = Boolean(row.is_active);
    if (row.created_at) record.createdAt = new Date(row.created_at).toISOString();
    if (row.updated_at) record.updatedAt = new Date(row.updated_at).toISOString();
  }

  return record;
}

function extractRecordTs(rec: any): number {
  if (!rec) return 0;
  const raw = rec.updatedAt || rec.updated_at || rec.createdAt || rec.created_at;
  if (raw) {
    const t = new Date(raw).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
}

export function mergeDedicatedAndDocumentRows(
  collection: string,
  dedicatedRows: any[],
  appDocItems: any[]
): any[] {
  const mergedMap = new Map<string, any>();

  // 1. Index dedicated table rows
  for (const dRow of dedicatedRows) {
    if (!dRow || !dRow.id) continue;
    const rec = mapDedicatedRowToRecord(collection, dRow);
    mergedMap.set(String(dRow.id), rec);
  }

  // 2. Overlay app_collections documents safely
  for (const doc of appDocItems) {
    if (!doc || !doc.id) continue;
    const docId = String(doc.id);
    const existing = mergedMap.get(docId);
    if (existing) {
      const docTs = extractRecordTs(doc);
      const existingTs = extractRecordTs(existing);

      if (docTs >= existingTs) {
        // Updated JSON document is newer or equal: JSON document takes priority!
        const merged: any = { ...existing, ...doc };
        delete merged._appUpdatedAt;
        mergedMap.set(docId, merged);
      } else {
        // Dedicated row is newer: overlay non-empty existing fields onto doc
        const merged: any = { ...doc };
        for (const key of Object.keys(existing)) {
          const val = existing[key];
          if (val === undefined || val === null) continue;
          if (typeof val === 'string' && (val === 'نامشخص' || val === 'کلاس بدون عنوان' || val === 'برنامه بدون عنوان') && doc[key] && doc[key] !== val) {
            continue;
          }
          if (Array.isArray(val) && val.length === 0 && Array.isArray(doc[key]) && doc[key].length > 0) {
            continue;
          }
          merged[key] = val;
        }
        delete merged._appUpdatedAt;
        if (!merged.updatedAt) {
          merged.updatedAt = doc.updatedAt || existing.updatedAt || new Date().toISOString();
        }
        mergedMap.set(docId, merged);
      }
    } else {
      const copy = { ...doc };
      delete copy._appUpdatedAt;
      if (!copy.updatedAt) copy.updatedAt = new Date().toISOString();
      mergedMap.set(docId, copy);
    }
  }

  return Array.from(mergedMap.values());
}


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

export class DbConnectionError extends Error {
  public isDbConnectionError = true;
  public code?: string;
  public statusCode = 503;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'DbConnectionError';
    this.code = code;
  }
}

export function isConnectionError(err: any): boolean {
  if (!err) return false;
  if (err.isDbConnectionError) return true;
  const code = err.code || '';
  const msg = (err.message || '').toLowerCase();
  const connErrorCodes = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'PROTOCOL_CONNECTION_LOST',
    'ER_CON_COUNT_ERROR',
    'ECONNRESET',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EPIPE',
    'EHOSTUNREACH',
    'ER_GET_CONNECTION_TIMEOUT'
  ];
  if (connErrorCodes.includes(code)) return true;
  if (
    msg.includes('connection lost') ||
    msg.includes('connect econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('pool initialization error') ||
    msg.includes('ارتباط با سرور دیتابیس برقرار نشد') ||
    msg.includes('too many connections') ||
    msg.includes('connection error')
  ) {
    return true;
  }
  return false;
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

  // If no MySQL configuration is provided at all, return gracefully without logging errors
  if (!conf.isConfigured && !conf.host && !conf.database && !conf.user) {
    return { isValid: false, errors: ['MySQL is not configured in this environment (using local JSON storage).'] };
  }

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
  if (!isValid && (conf.host || conf.database)) {
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

  // 2. Ensure all_users table exists (Comprehensive MySQL 8+ & MariaDB schema compatible with user's table)
  try {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`all_users\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`username\` VARCHAR(100) NOT NULL,
        \`password_hash\` VARCHAR(255) NULL,
        \`password\` VARCHAR(255) NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`role\` VARCHAR(50) NOT NULL DEFAULT 'student',
        \`role_title\` VARCHAR(100) NULL,
        \`avatar_url\` VARCHAR(500) NULL,
        \`level\` INT NOT NULL DEFAULT 3,
        \`grade_label\` VARCHAR(100) NULL,
        \`mentor_id\` VARCHAR(100) NULL,
        \`student_id\` VARCHAR(100) NULL,
        \`linked_student_id\` VARCHAR(100) NULL,
        \`teacher_id\` VARCHAR(100) NULL,
        \`avatar_bg\` VARCHAR(50) NULL,
        \`allowed_tabs\` JSON NULL,
        \`editable_tabs\` JSON NULL,
        \`module_permissions\` JSON NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`is_read_only\` TINYINT(1) NOT NULL DEFAULT 0,
        \`can_edit\` TINYINT(1) NOT NULL DEFAULT 1,
        \`must_change_password\` TINYINT(1) NOT NULL DEFAULT 0,
        \`failed_login_attempts\` INT NOT NULL DEFAULT 0,
        \`account_locked_until\` DATETIME NULL,
        \`last_login\` DATETIME NULL,
        \`data\` JSON NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_all_users_username\` (\`username\`),
        INDEX \`idx_all_users_role_level\` (\`role\`, \`level\`),
        INDEX \`idx_all_users_active\` (\`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[MySQL Schema] ✅ جدول all_users در پایگاه داده ایجاد/تأیید شد.');
  } catch (e: any) {
    console.warn('[MySQL Schema Notice - all_users]:', e?.message || e);
  }

  // 2.1 Ensure system_users table exists (for mirror & compatibility)
  try {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS \`system_users\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`username\` VARCHAR(100) NOT NULL,
        \`password_hash\` VARCHAR(255) NULL,
        \`password\` VARCHAR(255) NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`role\` VARCHAR(50) NOT NULL DEFAULT 'student',
        \`role_title\` VARCHAR(100) NULL,
        \`avatar_url\` VARCHAR(500) NULL,
        \`level\` INT NOT NULL DEFAULT 3,
        \`grade_label\` VARCHAR(100) NULL,
        \`mentor_id\` VARCHAR(100) NULL,
        \`student_id\` VARCHAR(100) NULL,
        \`linked_student_id\` VARCHAR(100) NULL,
        \`teacher_id\` VARCHAR(100) NULL,
        \`avatar_bg\` VARCHAR(50) NULL,
        \`allowed_tabs\` JSON NULL,
        \`editable_tabs\` JSON NULL,
        \`module_permissions\` JSON NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`is_read_only\` TINYINT(1) NOT NULL DEFAULT 0,
        \`can_edit\` TINYINT(1) NOT NULL DEFAULT 1,
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

  // 2.2 Ensure students dedicated table exists
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
        UNIQUE KEY \`uk_student_code\` (\`student_code\`),
        INDEX \`idx_student_national_id\` (\`national_id\`),
        INDEX \`idx_student_grade\` (\`grade\`),
        INDEX \`idx_student_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[MySQL Schema] ✅ جدول students در پایگاه داده ایجاد/تأیید شد.');
  } catch (e: any) {
    console.warn('[MySQL Schema Notice - students]:', e?.message || e);
  }

  // 2.3 Ensure teachers, classrooms and audit_logs tables exist
  try {
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
      CREATE TABLE IF NOT EXISTS \`audit_logs\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`user_id\` VARCHAR(100) NULL,
        \`username\` VARCHAR(100) NULL,
        \`user_role\` VARCHAR(50) NULL,
        \`action\` VARCHAR(100) NOT NULL,
        \`entity_type\` VARCHAR(100) NULL,
        \`entity_id\` VARCHAR(100) NULL,
        \`description\` TEXT NOT NULL,
        \`ip_address\` VARCHAR(50) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_audit_created\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e: any) {
    console.warn('[MySQL Schema Notice - auxiliary tables]:', e?.message || e);
  }

  // 2.4 Compatibility View: all_user -> all_users
  try {
    await mysqlPool.query(`CREATE OR REPLACE VIEW \`all_user\` AS SELECT * FROM \`all_users\``);
  } catch (viewErr) {
    // Silently continue if MySQL permissions restrict CREATE VIEW
  }

  // Ensure column migrations exist on both all_users and system_users
  for (const tbl of ['all_users', 'system_users']) {
    try {
      await mysqlPool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS role_title VARCHAR(100) NULL`);
    } catch (e: any) {
      try { await mysqlPool.query(`ALTER TABLE ${tbl} ADD COLUMN role_title VARCHAR(100) NULL`); } catch (err) {}
    }
    try {
      await mysqlPool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) NULL`);
    } catch (e: any) {
      try { await mysqlPool.query(`ALTER TABLE ${tbl} ADD COLUMN avatar_url VARCHAR(500) NULL`); } catch (err) {}
    }
    try {
      await mysqlPool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS password VARCHAR(255) NULL`);
    } catch (e: any) {
      try { await mysqlPool.query(`ALTER TABLE ${tbl} ADD COLUMN password VARCHAR(255) NULL`); } catch (err) {}
    }
    try {
      await mysqlPool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS is_read_only TINYINT(1) DEFAULT 0`);
    } catch (e: any) {
      try { await mysqlPool.query(`ALTER TABLE ${tbl} ADD COLUMN is_read_only TINYINT(1) DEFAULT 0`); } catch (err) {}
    }
    try {
      await mysqlPool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS can_edit TINYINT(1) DEFAULT 1`);
    } catch (e: any) {
      try { await mysqlPool.query(`ALTER TABLE ${tbl} ADD COLUMN can_edit TINYINT(1) DEFAULT 1`); } catch (err) {}
    }
    try {
      await mysqlPool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS teacher_id VARCHAR(100) NULL`);
    } catch (e: any) {
      try { await mysqlPool.query(`ALTER TABLE ${tbl} ADD COLUMN teacher_id VARCHAR(100) NULL`); } catch (err) {}
    }
  }

  // Safe explicit column sync between system_users and all_users
  try {
    await mysqlPool.query(`
      INSERT IGNORE INTO all_users (id, username, password_hash, name, role, role_title, level, grade_label, mentor_id, student_id, linked_student_id, avatar_bg, allowed_tabs, editable_tabs, module_permissions, is_active, must_change_password)
      SELECT id, username, password_hash, name, role, role_title, level, grade_label, mentor_id, student_id, linked_student_id, avatar_bg, allowed_tabs, editable_tabs, module_permissions, is_active, must_change_password
      FROM system_users
    `);
  } catch (e) {}

  // 2.3 Auto-seed Super Admin SADEGH if not present or has empty/old password hash
  try {
    let existingAdmin: any = null;
    try {
      const [r1]: any = await mysqlPool.query(
        `SELECT id, username, password_hash FROM all_users WHERE UPPER(username) = 'SADEGH' LIMIT 1`
      );
      if (r1 && r1.length > 0) existingAdmin = r1;
    } catch (e) {}

    if (!existingAdmin) {
      try {
        const [r2]: any = await mysqlPool.query(
          `SELECT id, username, password_hash FROM system_users WHERE UPPER(username) = 'SADEGH' LIMIT 1`
        );
        if (r2 && r2.length > 0) existingAdmin = r2;
      } catch (e) {}
    }

    const targetPassword = process.env.DEFAULT_ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD;

    if (!existingAdmin || existingAdmin.length === 0) {
      const defaultPass = targetPassword || '8411924As';
      const passwordHash = await bcrypt.hash(defaultPass, 10);
      const allTabsJson = JSON.stringify([
        'todos', 'workflow', 'academic-calendar', 'presence-hours', 'finance', 'students', 'active-students',
        'discussion', 'programs', 'classrooms', 'student-schedule', 'teachers-schedule', 'stats', 'research',
        'attendance', 'course-selection', 'comments', 'summary', 'teachers-bank', 'backup', 'user-management', 'user-credentials', 'audit-logs'
      ]);

      for (const tbl of ['all_users', 'system_users']) {
        await mysqlPool.query(`
          INSERT INTO ${tbl} (
            id, username, password_hash, name, role, role_title, level, grade_label,
            mentor_id, avatar_bg, allowed_tabs, editable_tabs, is_active, must_change_password
          ) VALUES (
            'user_sadegh', 'SADEGH', ?, 'صادق (سوپر ادمین)', 'super_admin', 'سوپر ادمین (مدیر کل سیستم)',
            1, 'کل سیستم', 'shahpoori', 'bg-indigo-700', ?, ?, 1, 0
          ) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name)
        `, [passwordHash, allTabsJson, allTabsJson]);
      }
      console.log(`[MySQL Startup] ✅ کاربر سوپر ادمین SADEGH با موفقیت در دیتابیس (جدول all_users) ساخته شد.`);
    } else {
      // existingAdmin exists! If password is provided, perform updates/migrations
      if (targetPassword) {
        const passwordHash = await bcrypt.hash(targetPassword, 10);
        const currentHash = existingAdmin[0].password_hash;
        if (!currentHash || currentHash === '') {
          for (const tbl of ['all_users', 'system_users']) {
            await mysqlPool.query(
              `UPDATE ${tbl} SET password_hash = ?, is_active = 1 WHERE UPPER(username) = 'SADEGH'`,
              [passwordHash]
            );
          }
          console.log(`[MySQL Startup] ✅ هش رمز عبور کاربر سوپر ادمین SADEGH به‌روزرسانی شد.`);
        } else {
          // If the administrator explicitly configured a target password via environment variable, apply it if different
          const isSamePassword = await bcrypt.compare(targetPassword, currentHash);
          if (!isSamePassword) {
            for (const tbl of ['all_users', 'system_users']) {
              await mysqlPool.query(
                `UPDATE ${tbl} SET password_hash = ?, is_active = 1 WHERE UPPER(username) = 'SADEGH'`,
                [passwordHash]
              );
            }
            console.log(`[MySQL Startup] 🔒 رمز عبور سوپر ادمین SADEGH مطابق متغیر محیطی در پایگاه داده به‌روزرسانی شد.`);
          }
        }
      }
    }
  } catch (adminSeedErr: any) {
    if (adminSeedErr?.message?.includes('Cannot create default super admin SADEGH')) {
      throw adminSeedErr;
    }
    console.warn('[MySQL Startup Notice - SADEGH Seed]:', adminSeedErr?.message || adminSeedErr);
  }

  // 2.4 Auto-sync initial users (e.g. RAHNAMA) from local storage into all_users & system_users
  try {
    const fs = await import('fs');
    const path = await import('path');
    const localUsersPath = path.join(process.cwd(), 'data', 'system_users.json');
    if (fs.existsSync(localUsersPath)) {
      const fileContent = fs.readFileSync(localUsersPath, 'utf8');
      const localUsers = JSON.parse(fileContent);
      if (Array.isArray(localUsers)) {
        for (const u of localUsers) {
          if (!u || !u.username) continue;
          const uName = String(u.username).trim().toUpperCase();
          if (uName === 'SADEGH') continue;

          const uId = u.id || `user_${uName.toLowerCase()}`;
          const pwdHash = u.passwordHash || null;
          const allowedTabs = JSON.stringify(u.allowedTabs || []);
          const editableTabs = JSON.stringify(u.editableTabs || []);
          const modulePerms = JSON.stringify(u.modulePermissions || {});

          const upsertUserSql = (tbl: string) => `
            INSERT INTO ${tbl} (
              id, username, password_hash, name, role, role_title, level, grade_label,
              mentor_id, avatar_bg, allowed_tabs, editable_tabs, module_permissions,
              is_active, must_change_password
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              password_hash = IF(VALUES(password_hash) IS NOT NULL AND VALUES(password_hash) != '', VALUES(password_hash), password_hash),
              name = VALUES(name),
              role = VALUES(role),
              role_title = VALUES(role_title),
              allowed_tabs = VALUES(allowed_tabs),
              editable_tabs = VALUES(editable_tabs);
          `;

          const uParams = [
            uId, uName, pwdHash, u.name || uName, u.role || 'student', u.roleTitle || null,
            u.level || 3, u.gradeLabel || null, u.mentorId || null, u.avatarBg || null,
            allowedTabs, editableTabs, modulePerms, u.isActive !== false ? 1 : 0, u.mustChangePassword ? 1 : 0
          ];

          try { await mysqlPool.query(upsertUserSql('all_users'), uParams); } catch (e) {}
          try { await mysqlPool.query(upsertUserSql('system_users'), uParams); } catch (e) {}
        }
      }
    }
  } catch (otherSeedErr: any) {
    console.warn('[MySQL Startup Notice - User Sync]:', otherSeedErr?.message || otherSeedErr);
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

    // Column migrations for programs table (counseling link, program types, json data)
    try {
      const progAlters = [
        'ALTER TABLE programs ADD COLUMN IF NOT EXISTS type VARCHAR(50) NULL DEFAULT "اصلی"',
        'ALTER TABLE programs ADD COLUMN IF NOT EXISTS parent_program_id VARCHAR(100) NULL',
        'ALTER TABLE programs ADD COLUMN IF NOT EXISTS data JSON NULL',
        'ALTER TABLE programs ADD COLUMN IF NOT EXISTS subject_category VARCHAR(150) NULL',
        'ALTER TABLE programs ADD COLUMN IF NOT EXISTS subject_book VARCHAR(150) NULL',
        'ALTER TABLE programs ADD COLUMN IF NOT EXISTS subject_chapter VARCHAR(150) NULL'
      ];
      for (const sql of progAlters) {
        try { await mysqlPool.query(sql); } catch (e) {
          const rawSql = sql.replace(' IF NOT EXISTS', '');
          try { await mysqlPool.query(rawSql); } catch (e2) {}
        }
      }
    } catch (e) {}

    // Column migrations for attendance table (support session logs with student_id nullable)
    try {
      const attAlters = [
        'ALTER TABLE attendance MODIFY COLUMN student_id VARCHAR(100) NULL',
        'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS grade VARCHAR(100) NULL',
        'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS present_count INT NOT NULL DEFAULT 0',
        'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS absent_count INT NOT NULL DEFAULT 0',
        'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS data JSON NULL'
      ];
      for (const sql of attAlters) {
        try { await mysqlPool.query(sql); } catch (e) {
          const rawSql = sql.replace(' IF NOT EXISTS', '');
          try { await mysqlPool.query(rawSql); } catch (e2) {}
        }
      }
    } catch (e) {}

    // Ensure data JSON column exists on all other dedicated tables
    for (const tbl of ['students', 'classrooms', 'teachers', 'enrollments', 'student_requests']) {
      try {
        await mysqlPool.query(`ALTER TABLE \`${tbl}\` ADD COLUMN IF NOT EXISTS data JSON NULL`);
      } catch (e) {
        try { await mysqlPool.query(`ALTER TABLE \`${tbl}\` ADD COLUMN data JSON NULL`); } catch (e2) {}
      }
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
  const conf = parseMysqlConfig();
  if (!conf.isConfigured && !conf.host && !conf.database) {
    return null;
  }

  const { isValid, errors } = validateMysqlConfig();
  if (!isValid) {
    lastConnectionError = errors.join(' | ');
    return null;
  }

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
        timezone: 'Z',
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        idleTimeout: 60000,
        maxIdle: 3
      } as any);

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
      // 1. Query dedicated all_users table first
      let [rows]: any = await pool.execute(
        `SELECT id, username, password_hash AS passwordHash, name, role, role_title AS roleTitle,
                level, grade_label AS gradeLabel, mentor_id AS mentorId, student_id AS studentId,
                linked_student_id AS linkedStudentId, avatar_bg AS avatarBg,
                allowed_tabs AS allowedTabs, editable_tabs AS editableTabs, module_permissions AS modulePermissions,
                is_active AS isActive, must_change_password AS mustChangePassword,
                failed_login_attempts AS failedLoginAttempts, account_locked_until AS accountLockedUntil,
                last_login AS lastLogin, data
         FROM all_users
         WHERE UPPER(username) = UPPER(?) LIMIT 1`,
        [username]
      );

      // 2. Fallback to system_users if not found in all_users
      if (!rows || rows.length === 0) {
        [rows] = await pool.execute(
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
      }

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
      let [rows]: any = await pool.execute(
        `SELECT id, username, password_hash AS passwordHash, name, role, role_title AS roleTitle,
                level, grade_label AS gradeLabel, mentor_id AS mentorId, student_id AS studentId,
                linked_student_id AS linkedStudentId, avatar_bg AS avatarBg,
                allowed_tabs AS allowedTabs, editable_tabs AS editableTabs, module_permissions AS modulePermissions,
                is_active AS isActive, must_change_password AS mustChangePassword,
                failed_login_attempts AS failedLoginAttempts, account_locked_until AS accountLockedUntil,
                last_login AS lastLogin, data
         FROM all_users ORDER BY level ASC, name ASC`
      );

      if (!rows || rows.length === 0) {
        [rows] = await pool.execute(
          `SELECT id, username, password_hash AS passwordHash, name, role, role_title AS roleTitle,
                  level, grade_label AS gradeLabel, mentor_id AS mentorId, student_id AS studentId,
                  linked_student_id AS linkedStudentId, avatar_bg AS avatarBg,
                  allowed_tabs AS allowedTabs, editable_tabs AS editableTabs, module_permissions AS modulePermissions,
                  is_active AS isActive, must_change_password AS mustChangePassword,
                  failed_login_attempts AS failedLoginAttempts, account_locked_until AS accountLockedUntil,
                  last_login AS lastLogin, data
           FROM system_users ORDER BY level ASC, name ASC`
        );
      }

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

  // 2b. Fetch Single User By Username (Fast O(1) Index Lookup)
  async getUserByUsername(username: string): Promise<SystemUserEntity | null> {
    const pool = getMysqlPool();
    if (!pool) {
      if (isMysqlConfigured) {
        throw new DbConnectionError('ارتباط با پایگاه داده MySQL برقرار نشد.');
      }
      return null;
    }
    if (!username) return null;
    const cleanUser = username.trim().toUpperCase();

    try {
      let [rows]: any = await pool.execute(
        `SELECT id, username, password_hash AS passwordHash, password, name, role, role_title AS roleTitle,
                level, grade_label AS gradeLabel, mentor_id AS mentorId, student_id AS studentId,
                linked_student_id AS linkedStudentId, avatar_bg AS avatarBg,
                allowed_tabs AS allowedTabs, editable_tabs AS editableTabs, module_permissions AS modulePermissions,
                is_active AS isActive, is_read_only AS isReadOnly, can_edit AS canEdit, must_change_password AS mustChangePassword,
                failed_login_attempts AS failedLoginAttempts, account_locked_until AS accountLockedUntil,
                last_login AS lastLogin, data
         FROM all_users WHERE UPPER(username) = ? LIMIT 1`,
        [cleanUser]
      );

      if (!rows || rows.length === 0) {
        [rows] = await pool.execute(
          `SELECT id, username, password_hash AS passwordHash, password, name, role, role_title AS roleTitle,
                  level, grade_label AS gradeLabel, mentor_id AS mentorId, student_id AS studentId,
                  linked_student_id AS linkedStudentId, avatar_bg AS avatarBg,
                  allowed_tabs AS allowedTabs, editable_tabs AS editableTabs, module_permissions AS modulePermissions,
                  is_active AS isActive, is_read_only AS isReadOnly, can_edit AS canEdit, must_change_password AS mustChangePassword,
                  failed_login_attempts AS failedLoginAttempts, account_locked_until AS accountLockedUntil,
                  last_login AS lastLogin, data
           FROM system_users WHERE UPPER(username) = ? LIMIT 1`,
          [cleanUser]
        );
      }

      if (!rows || rows.length === 0) return null;

      const u = rows[0];
      return {
        ...u,
        allowedTabs: typeof u.allowedTabs === 'string' ? JSON.parse(u.allowedTabs) : u.allowedTabs || [],
        editableTabs: typeof u.editableTabs === 'string' ? JSON.parse(u.editableTabs) : u.editableTabs || [],
        modulePermissions: typeof u.modulePermissions === 'string' ? JSON.parse(u.modulePermissions) : u.modulePermissions || {},
        isActive: Boolean(u.isActive),
        mustChangePassword: Boolean(u.mustChangePassword)
      };
    } catch (e: any) {
      const errStr = (e?.message || String(e)).toLowerCase();
      const isDbConn = isConnectionError(e) ||
        e?.code === 'ECONNREFUSED' ||
        e?.code === 'ETIMEDOUT' ||
        errStr.includes('econnrefused') ||
        errStr.includes('etimedout') ||
        errStr.includes('socket hang up') ||
        errStr.includes('connection lost');

      if (isDbConn) {
        console.error('[STORAGE_FAILURE] MySQL getUserByUsername DB connection error:', e?.message || e);
        throw new Error('DbConnectionError: ' + (e?.message || 'MySQL Connection Error'));
      }
      console.warn('[MySQL getUserByUsername Warning]:', e?.message || e);
      return null;
    }
  },

  // 3. Upsert User (Insert or Update with Prepared Statement into both all_users and system_users)
  async saveUser(user: SystemUserEntity): Promise<void> {
    const pool = getMysqlPool();
    if (!pool) return;

    const uName = (user.username || '').trim().toUpperCase();
    if (!uName) return;

    const uId = user.id || `user_${uName.toLowerCase()}`;
    const pHash = user.passwordHash || (user as any).password || null;
    const plainPass = (user as any).password || null;
    const allowedTabs = JSON.stringify(user.allowedTabs || []);
    const editableTabs = JSON.stringify(user.editableTabs || []);
    const modulePerms = JSON.stringify(user.modulePermissions || {});
    const userData = JSON.stringify(user.data || {});
    const isActive = user.isActive !== false ? 1 : 0;
    const isReadOnly = (user as any).isReadOnly ? 1 : 0;
    const canEdit = (user as any).canEdit !== false ? 1 : 0;
    const mustChange = user.mustChangePassword ? 1 : 0;
    const failedAttempts = Number(user.failedLoginAttempts) || 0;
    const lockedUntil = user.accountLockedUntil ? new Date(user.accountLockedUntil) : null;
    const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;

    // 1. Direct UPSERT into all_users (supporting both custom and standard schema)
    try {
      const sqlAllUsers = `
        INSERT INTO all_users (
          id, username, password_hash, password, name, role, role_title, level, grade_label,
          mentor_id, student_id, linked_student_id, teacher_id, avatar_bg, allowed_tabs,
          editable_tabs, module_permissions, is_active, is_read_only, can_edit, must_change_password,
          failed_login_attempts, account_locked_until, last_login, data, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          name = ?,
          password_hash = COALESCE(NULLIF(?, ''), password_hash),
          password = COALESCE(NULLIF(?, ''), password),
          role = ?,
          role_title = ?,
          level = ?,
          grade_label = ?,
          mentor_id = ?,
          student_id = ?,
          linked_student_id = ?,
          teacher_id = ?,
          avatar_bg = ?,
          allowed_tabs = ?,
          editable_tabs = ?,
          module_permissions = ?,
          is_active = ?,
          is_read_only = ?,
          can_edit = ?,
          must_change_password = ?,
          failed_login_attempts = ?,
          account_locked_until = ?,
          last_login = ?,
          data = ?,
          updated_at = NOW();
      `;

      const userRole = user.role || 'student';
      const userLevel = Number(user.level) || 3;
      const userGrade = cleanNullableStr(user.gradeLabel || (user as any).grade);
      const teacherId = cleanNullableStr((user as any).teacherId);
      const userName = cleanNullableStr(user.name || (user as any).fullName) || uName;
      const mentorId = cleanNullableStr(user.mentorId);
      const studentId = cleanNullableStr(user.studentId);
      const linkedStudentId = cleanNullableStr(user.linkedStudentId);
      const avatarBg = cleanNullableStr(user.avatarBg);
      const roleTitle = cleanNullableStr(user.roleTitle);

      await pool.query(sqlAllUsers, [
        uId, uName, pHash, plainPass, userName, userRole, roleTitle,
        userLevel, userGrade, mentorId,
        studentId, linkedStudentId, teacherId,
        avatarBg, allowedTabs, editableTabs, modulePerms, isActive,
        isReadOnly, canEdit, mustChange, failedAttempts, lockedUntil, lastLogin, userData,
        // UPDATE params
        userName, pHash, plainPass, userRole, roleTitle,
        userLevel, userGrade, mentorId,
        studentId, linkedStudentId, teacherId,
        avatarBg, allowedTabs, editableTabs, modulePerms, isActive,
        isReadOnly, canEdit, mustChange, failedAttempts, lockedUntil, lastLogin, userData
      ]);
      console.log(`[MySQL saveUser] ✅ کاربر ${uName} با موفقیت در جدول all_users ذخیره شد.`);
    } catch (e1: any) {
      console.warn('[MySQL saveUser all_users notice]:', e1?.message || e1);
      // Fallback with minimal columns if some columns are missing
      try {
        const userName = cleanNullableStr(user.name || (user as any).fullName) || uName;
        const userRole = user.role || 'student';
        const roleTitle = cleanNullableStr(user.roleTitle);
        await pool.query(`
          INSERT INTO all_users (id, username, password_hash, name, role, role_title, level, grade_label, is_active, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            name = ?,
            password_hash = COALESCE(NULLIF(?, ''), password_hash),
            role = ?,
            is_active = ?,
            updated_at = NOW();
        `, [
          uId, uName, pHash, userName, userRole, roleTitle, Number(user.level) || 3, cleanNullableStr(user.gradeLabel || (user as any).grade), isActive,
          userName, pHash, userRole, isActive
        ]);
      } catch (fallbackErr: any) {
        console.error(`[STORAGE_FAILURE] MySQL saveUser all_users fallback failed for user "${uName}":`, fallbackErr?.message || fallbackErr);
      }
    }

    // 2. Mirror into system_users (if table exists)
    try {
      const userName = cleanNullableStr(user.name || (user as any).fullName) || uName;
      const userRole = user.role || 'student';
      const roleTitle = cleanNullableStr(user.roleTitle);
      const mentorId = cleanNullableStr(user.mentorId);
      const studentId = cleanNullableStr(user.studentId);
      const linkedStudentId = cleanNullableStr(user.linkedStudentId);
      const avatarBg = cleanNullableStr(user.avatarBg);
      const userGrade = cleanNullableStr(user.gradeLabel || (user as any).grade);

      await pool.query(`
        INSERT INTO system_users (
          id, username, password_hash, name, role, role_title, level, grade_label,
          mentor_id, student_id, linked_student_id, avatar_bg, allowed_tabs,
          editable_tabs, module_permissions, is_active, must_change_password, data, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          name = ?,
          password_hash = COALESCE(NULLIF(?, ''), password_hash),
          role = ?,
          is_active = ?,
          updated_at = NOW();
      `, [
        uId, uName, pHash, userName, userRole, roleTitle,
        Number(user.level) || 3, userGrade, mentorId,
        studentId, linkedStudentId, avatarBg,
        allowedTabs, editableTabs, modulePerms, isActive, mustChange, userData,
        userName, pHash, userRole, isActive
      ]);
    } catch (e2: any) {
      console.warn(`[STORAGE_FAILURE] MySQL saveUser system_users mirror notice for user "${uName}":`, e2?.message || e2);
    }

    // 3. Mirror into app_collections for unified querying under both names
    try {
      const userDoc = { ...user, id: uId, username: uName };
      await this.saveDocument('all_users', uId, userDoc);
      await this.saveDocument('system_users', uId, userDoc);
    } catch (e3: any) {
      console.warn(`[STORAGE_FAILURE] MySQL saveUser app_collections mirror notice for user "${uName}":`, e3?.message || e3);
    }
  },

  // 4. Record Audit Log
  async recordAuditLog(log: AuditLogEntity): Promise<void> {
    const pool = getMysqlPool();
    if (!pool) return;

    try {
      const id = log.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await pool.query(
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

    try {
      const [result]: any = await pool.query(sql, [collectionName, id, jsonStr, jsonStr]);
      const affectedRows = Number(result?.affectedRows) || 0;
      return { affectedRows };
    } catch (err: any) {
      if (err?.code === 'ER_NO_SUCH_TABLE' || err?.message?.includes("doesn't exist")) {
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS \`app_collections\` (
              \`collection_name\` VARCHAR(100) NOT NULL,
              \`id\` VARCHAR(150) NOT NULL,
              \`data\` JSON NOT NULL,
              \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`collection_name\`, \`id\`),
              INDEX \`idx_col_name\` (\`collection_name\`),
              INDEX \`idx_col_updated\` (\`updated_at\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `);
          const [retryRes]: any = await pool.query(sql, [collectionName, id, jsonStr, jsonStr]);
          return { affectedRows: Number(retryRes?.affectedRows) || 0 };
        } catch (createErr) {
          throw err;
        }
      }
      throw err;
    }
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
            student_code = ?,
            national_id = ?,
            name = ?,
            father_name = ?,
            grade = ?,
            phone = ?,
            address = ?,
            status = ?,
            is_active = ?,
            entry_year = ?,
            mentor_id = ?,
            notes = ?,
            data = ?,
            updated_at = NOW();
        `;
        const codeVal = cleanNullableStr(row.student_code);
        const natVal = cleanNullableStr(row.national_id);
        const nameVal = row.name || 'نامشخص';
        const fatherVal = cleanNullableStr(row.father_name);
        const gradeVal = row.grade || 'نامشخص';
        const phoneVal = cleanNullableStr(row.phone);
        const addressVal = cleanNullableStr(row.address);
        const statusVal = row.status || 'active';
        const activeVal = row.is_active !== undefined ? (row.is_active ? 1 : 0) : 1;
        const entryVal = cleanNullableStr(row.entry_year);
        const mentorVal = cleanNullableStr(row.mentor_id);
        const notesVal = cleanNullableStr(row.notes);
        const dataJson = JSON.stringify(row.data || {});

        const params = [
          row.id, codeVal, natVal, nameVal, fatherVal, gradeVal, phoneVal, addressVal, statusVal, activeVal, entryVal, mentorVal, notesVal, dataJson,
          codeVal, natVal, nameVal, fatherVal, gradeVal, phoneVal, addressVal, statusVal, activeVal, entryVal, mentorVal, notesVal, dataJson
        ];
        try {
          await pool.query(sql, params);
        } catch (sErr: any) {
          if (sErr?.code === 'ER_NO_SUCH_TABLE' || sErr?.message?.includes("doesn't exist")) {
            await pool.query(`
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
                UNIQUE KEY \`uk_student_code\` (\`student_code\`),
                INDEX \`idx_student_national_id\` (\`national_id\`),
                INDEX \`idx_student_grade\` (\`grade\`),
                INDEX \`idx_student_status\` (\`status\`)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            await pool.query(sql, params);
          } else {
            console.error(`[STORAGE_FAILURE] Dedicated table students query error for id "${row.id}":`, sErr?.message || sErr);
            throw sErr;
          }
        }
      } else if (tableName === 'classrooms') {
        const sql = `
          INSERT INTO classrooms (id, title, grade, capacity, location, data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            title = ?,
            grade = ?,
            capacity = ?,
            location = ?,
            data = ?,
            updated_at = NOW();
        `;
        const titleVal = row.title || 'کلاس بدون عنوان';
        const gradeVal = row.grade || null;
        const capVal = Number(row.capacity) || 20;
        const locVal = row.location || null;
        const dataJson = JSON.stringify(row.data || {});

        const params = [
          row.id, titleVal, gradeVal, capVal, locVal, dataJson,
          titleVal, gradeVal, capVal, locVal, dataJson
        ];
        try {
          await pool.query(sql, params);
        } catch (cErr: any) {
          if (cErr?.code === 'ER_NO_SUCH_TABLE' || cErr?.message?.includes("doesn't exist")) {
            await pool.query(`
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
            await pool.query(sql, params);
          } else {
            throw cErr;
          }
        }
      } else if (tableName === 'programs') {
        const sql = `
          INSERT INTO programs (id, title, grade, teacher_id, teacher_name, classroom_id, day_of_week, start_time, end_time, type, parent_program_id, representative_student_ids, representative_names, term, data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            title = ?,
            grade = ?,
            teacher_id = ?,
            teacher_name = ?,
            classroom_id = ?,
            day_of_week = ?,
            start_time = ?,
            end_time = ?,
            type = ?,
            parent_program_id = ?,
            representative_student_ids = ?,
            representative_names = ?,
            term = ?,
            data = ?,
            updated_at = NOW();
        `;
        const titleVal = row.title || 'برنامه بدون عنوان';
        const gradeVal = row.grade || 'نامشخص';
        const teacherIdVal = cleanNullableStr(row.teacher_id);
        const teacherNameVal = cleanNullableStr(row.teacher_name || row.teacher);
        const classroomIdVal = cleanNullableStr(row.classroom_id || row.classroom || row.madrasRoom);
        const dayVal = cleanNullableStr(row.day_of_week || row.day);
        const startTimeVal = cleanNullableStr(row.start_time || row.startTime);
        const endTimeVal = cleanNullableStr(row.end_time || row.endTime);
        const typeVal = cleanNullableStr(row.type) || 'اصلی';
        const parentProgVal = cleanNullableStr(row.parent_program_id || row.parentProgramId || row.linkedMainLessonId);
        const repIdsVal = typeof row.representative_student_ids === 'string' ? row.representative_student_ids : JSON.stringify(row.representative_student_ids || row.data?.representativeStudentIds || []);
        const repNamesVal = typeof row.representative_names === 'string' ? row.representative_names : JSON.stringify(row.representative_names || row.data?.representativeNames || []);
        const termVal = cleanNullableStr(row.term || row.data?.term);
        const dataJson = JSON.stringify(row.data || {});

        const params = [
          row.id, titleVal, gradeVal, teacherIdVal, teacherNameVal, classroomIdVal, dayVal, startTimeVal, endTimeVal, typeVal, parentProgVal, repIdsVal, repNamesVal, termVal, dataJson,
          titleVal, gradeVal, teacherIdVal, teacherNameVal, classroomIdVal, dayVal, startTimeVal, endTimeVal, typeVal, parentProgVal, repIdsVal, repNamesVal, termVal, dataJson
        ];

        try {
          await pool.query(sql, params);
        } catch (pErr: any) {
          if (pErr?.code === 'ER_NO_SUCH_TABLE' || pErr?.message?.includes("doesn't exist")) {
            await pool.query(`
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
                \`type\` VARCHAR(50) NULL DEFAULT 'اصلی',
                \`parent_program_id\` VARCHAR(100) NULL,
                \`representative_student_ids\` TEXT NULL,
                \`representative_names\` TEXT NULL,
                \`term\` VARCHAR(100) NULL,
                \`data\` JSON NULL,
                \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                INDEX \`idx_programs_grade\` (\`grade\`),
                INDEX \`idx_programs_teacher\` (\`teacher_id\`)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            await pool.query(sql, params);
          } else if (pErr?.code === 'ER_BAD_FIELD_ERROR' || pErr?.message?.includes('Unknown column')) {
            // Auto-heal missing columns on live MySQL
            try { await pool.query('ALTER TABLE programs ADD COLUMN type VARCHAR(50) NULL DEFAULT "اصلی"'); } catch (e) {}
            try { await pool.query('ALTER TABLE programs ADD COLUMN parent_program_id VARCHAR(100) NULL'); } catch (e) {}
            try { await pool.query('ALTER TABLE programs ADD COLUMN representative_student_ids TEXT NULL'); } catch (e) {}
            try { await pool.query('ALTER TABLE programs ADD COLUMN representative_names TEXT NULL'); } catch (e) {}
            try { await pool.query('ALTER TABLE programs ADD COLUMN term VARCHAR(100) NULL'); } catch (e) {}
            try { await pool.query('ALTER TABLE programs ADD COLUMN data JSON NULL'); } catch (e) {}
            await pool.query(sql, params);
          } else {
            throw pErr;
          }
        }
      } else if (tableName === 'attendance') {
        const sql = `
          INSERT INTO attendance (id, student_id, date, program_id, grade, present_count, absent_count, data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            student_id = ?,
            date = ?,
            program_id = ?,
            grade = ?,
            present_count = ?,
            absent_count = ?,
            data = ?,
            updated_at = NOW();
        `;
        const studentIdVal = cleanNullableStr(row.student_id);
        const dateVal = row.date || new Date().toISOString().split('T')[0];
        const programIdVal = cleanNullableStr(row.program_id || row.programId);
        const gradeVal = row.grade || 'نامشخص';
        const presentCountVal = Number(row.present_count ?? row.presentCount) || 0;
        const absentCountVal = Number(row.absent_count ?? row.absentCount) || 0;
        const dataJson = JSON.stringify(row.data || {});

        const params = [
          row.id, studentIdVal, dateVal, programIdVal, gradeVal, presentCountVal, absentCountVal, dataJson,
          studentIdVal, dateVal, programIdVal, gradeVal, presentCountVal, absentCountVal, dataJson
        ];

        try {
          await pool.query(sql, params);
        } catch (aErr: any) {
          if (aErr?.code === 'ER_NO_SUCH_TABLE' || aErr?.message?.includes("doesn't exist")) {
            await pool.query(`
              CREATE TABLE IF NOT EXISTS \`attendance\` (
                \`id\` VARCHAR(100) NOT NULL,
                \`student_id\` VARCHAR(100) NULL,
                \`date\` VARCHAR(50) NOT NULL,
                \`program_id\` VARCHAR(100) NULL,
                \`grade\` VARCHAR(100) NULL,
                \`present_count\` INT NOT NULL DEFAULT 0,
                \`absent_count\` INT NOT NULL DEFAULT 0,
                \`data\` JSON NULL,
                \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                INDEX \`idx_attendance_date\` (\`date\`),
                INDEX \`idx_attendance_program\` (\`program_id\`)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            await pool.query(sql, params);
          } else if (aErr?.code === 'ER_BAD_FIELD_ERROR' || aErr?.message?.includes('Unknown column') || aErr?.message?.includes("doesn't have a default value")) {
            // Auto-heal missing columns on live MySQL
            try { await pool.query('ALTER TABLE attendance MODIFY COLUMN student_id VARCHAR(100) NULL'); } catch (e) {}
            try { await pool.query('ALTER TABLE attendance ADD COLUMN grade VARCHAR(100) NULL'); } catch (e) {}
            try { await pool.query('ALTER TABLE attendance ADD COLUMN present_count INT NOT NULL DEFAULT 0'); } catch (e) {}
            try { await pool.query('ALTER TABLE attendance ADD COLUMN absent_count INT NOT NULL DEFAULT 0'); } catch (e) {}
            try { await pool.query('ALTER TABLE attendance ADD COLUMN data JSON NULL'); } catch (e) {}
            await pool.query(sql, params);
          } else {
            throw aErr;
          }
        }
      } else if (tableName === 'teachers') {
        const sql = `
          INSERT INTO teachers (id, name, specialty, phone, email, is_active, data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            name = ?,
            specialty = ?,
            phone = ?,
            email = ?,
            is_active = ?,
            data = ?,
            updated_at = NOW();
        `;
        const nameVal = row.name || 'نامشخص';
        const specialtyVal = cleanNullableStr(row.specialty);
        const phoneVal = cleanNullableStr(row.phone);
        const emailVal = cleanNullableStr(row.email);
        const activeVal = row.is_active !== undefined ? (row.is_active ? 1 : 0) : 1;
        const dataJson = JSON.stringify(row.data || {});

        const params = [
          row.id, nameVal, specialtyVal, phoneVal, emailVal, activeVal, dataJson,
          nameVal, specialtyVal, phoneVal, emailVal, activeVal, dataJson
        ];

        try {
          await pool.query(sql, params);
        } catch (tErr: any) {
          if (tErr?.code === 'ER_NO_SUCH_TABLE' || tErr?.message?.includes("doesn't exist")) {
            await pool.query(`
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
            await pool.query(sql, params);
          } else {
            throw tErr;
          }
        }
      } else if (tableName === 'enrollments') {
        const sql = `
          INSERT INTO enrollments (id, student_id, program_id, grade, status, data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            student_id = ?,
            program_id = ?,
            grade = ?,
            status = ?,
            data = ?,
            updated_at = NOW();
        `;
        const studentIdVal = row.student_id || row.studentId || 'unknown';
        const programIdVal = row.program_id || row.programId || 'unknown';
        const gradeVal = cleanNullableStr(row.grade);
        const statusVal = row.status || 'enrolled';
        const dataJson = JSON.stringify(row.data || {});

        const params = [
          row.id, studentIdVal, programIdVal, gradeVal, statusVal, dataJson,
          studentIdVal, programIdVal, gradeVal, statusVal, dataJson
        ];

        try {
          await pool.query(sql, params);
        } catch (eErr: any) {
          if (eErr?.code === 'ER_NO_SUCH_TABLE' || eErr?.message?.includes("doesn't exist")) {
            await pool.query(`
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
                INDEX \`idx_enrollments_student\` (\`student_id\`),
                INDEX \`idx_enrollments_program\` (\`program_id\`)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            await pool.query(sql, params);
          } else if (eErr?.code === 'ER_BAD_FIELD_ERROR' || eErr?.message?.includes('Unknown column')) {
            try { await pool.query('ALTER TABLE enrollments ADD COLUMN data JSON NULL'); } catch (e) {}
            await pool.query(sql, params);
          } else {
            throw eErr;
          }
        }
      } else if (tableName === 'student_requests') {
        const sql = `
          INSERT INTO student_requests (id, student_id, unit, type, status, data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            student_id = ?,
            unit = ?,
            type = ?,
            status = ?,
            data = ?,
            updated_at = NOW();
        `;
        const studentIdVal = row.student_id || row.studentId || 'unknown';
        const unitVal = row.unit || 'آموزش';
        const typeVal = row.type || 'عمومی';
        const statusVal = row.status || 'pending';
        const dataJson = JSON.stringify(row.data || {});

        const params = [
          row.id, studentIdVal, unitVal, typeVal, statusVal, dataJson,
          studentIdVal, unitVal, typeVal, statusVal, dataJson
        ];

        try {
          await pool.query(sql, params);
        } catch (srErr: any) {
          if (srErr?.code === 'ER_NO_SUCH_TABLE' || srErr?.message?.includes("doesn't exist")) {
            await pool.query(`
              CREATE TABLE IF NOT EXISTS \`student_requests\` (
                \`id\` VARCHAR(100) NOT NULL,
                \`student_id\` VARCHAR(100) NOT NULL,
                \`unit\` VARCHAR(100) NOT NULL,
                \`type\` VARCHAR(100) NOT NULL,
                \`status\` VARCHAR(50) NOT NULL DEFAULT 'pending',
                \`data\` JSON NULL,
                \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                INDEX \`idx_req_student\` (\`student_id\`),
                INDEX \`idx_req_unit\` (\`unit\`),
                INDEX \`idx_req_status\` (\`status\`)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            await pool.query(sql, params);
          } else {
            throw srErr;
          }
        }
      }
    } catch (e: any) {
      console.error(`[MySQL Dedicated Table Error] ${tableName}:`, e?.message || e);
      throw e;
    }
  },

  // 6. Delete Document
  async deleteDocument(collectionName: string, id: string): Promise<{ affectedRows: number }> {
    const pool = getMysqlPool();
    if (!pool) {
      throw new Error('MySQL connection pool is not configured or unavailable.');
    }

    let affectedRows = 0;
    try {
      const [result]: any = await pool.query(
        `DELETE FROM app_collections WHERE collection_name = ? AND id = ?`,
        [collectionName, id]
      );
      affectedRows = Number(result?.affectedRows) || 0;
    } catch (e: any) {
      console.error(`[STORAGE_FAILURE] MySQL deleteDocument app_collections error for collection "${collectionName}" id "${id}":`, e?.message || e);
    }

    // Also delete from dedicated tables if applicable
    const delTable = async (table: string) => {
      try {
        await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
      } catch (e: any) {
        console.error(`[STORAGE_FAILURE] MySQL deleteDocument ${table} table error for id "${id}":`, e?.message || e);
      }
    };

    if (collectionName === 'students') {
      await delTable('students');
    } else if (collectionName === 'teachers') {
      await delTable('teachers');
    } else if (collectionName === 'classrooms' || collectionName === 'classes') {
      await delTable('classrooms');
    } else if (collectionName === 'programs') {
      await delTable('programs');
    } else if (collectionName === 'attendance') {
      await delTable('attendance');
    } else if (collectionName === 'enrollments') {
      await delTable('enrollments');
    } else if (collectionName === 'student_requests') {
      await delTable('student_requests');
    } else if (collectionName === 'system_users' || collectionName === 'all_users') {
      try {
        await pool.query(`DELETE FROM all_users WHERE id = ? OR UPPER(username) = UPPER(?)`, [id, id]);
      } catch (e: any) {
        console.error(`[STORAGE_FAILURE] MySQL deleteDocument all_users table error for id "${id}":`, e?.message || e);
      }
      try {
        await pool.query(`DELETE FROM system_users WHERE id = ? OR UPPER(username) = UPPER(?)`, [id, id]);
      } catch (e: any) {
        console.error(`[STORAGE_FAILURE] MySQL deleteDocument system_users table error for id "${id}":`, e?.message || e);
      }
    }

    return { affectedRows };
  },

  // 6b. Delete User
  async deleteUser(userIdOrUsername: string): Promise<void> {
    const pool = getMysqlPool();
    if (!pool) return;

    try {
      await pool.query(
        `DELETE FROM all_users WHERE id = ? OR UPPER(username) = UPPER(?)`,
        [userIdOrUsername, userIdOrUsername]
      );
      await pool.query(
        `DELETE FROM system_users WHERE id = ? OR UPPER(username) = UPPER(?)`,
        [userIdOrUsername, userIdOrUsername]
      );
      await pool.query(
        `DELETE FROM app_collections WHERE collection_name IN ('all_users', 'system_users') AND (id = ? OR UPPER(id) = UPPER(?))`,
        [userIdOrUsername, userIdOrUsername]
      );
    } catch (e: any) {
      console.error(`[STORAGE_FAILURE] MySQL deleteUser Error for "${userIdOrUsername}":`, e?.message || e);
    }
  },

  // 7. Get Single Document by Primary Key
  async getDocument(collectionName: string, id: string): Promise<any | null> {
    const pool = getMysqlPool();
    if (!pool) return null;

    let appDoc: any = null;
    try {
      const [rows]: any = await pool.query(
        `SELECT data FROM app_collections WHERE collection_name = ? AND id = ? LIMIT 1`,
        [collectionName, id]
      );

      if (rows && rows.length > 0) {
        const r = rows[0];
        const parsed = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        appDoc = { ...parsed, id };
      }
    } catch (e: any) {
      console.warn(`[STORAGE_FAILURE] MySQL getDocument notice for collection "${collectionName}" id "${id}":`, e?.message || e);
    }

    const checkDedicated = async (table: string, colName: string) => {
      try {
        const [dRows]: any = await pool.query(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`, [id]);
        if (dRows && dRows.length > 0) {
          const mergedList = mergeDedicatedAndDocumentRows(colName, [dRows[0]], appDoc ? [appDoc] : []);
          return mergedList[0] || appDoc;
        }
      } catch (e) {}
      return appDoc;
    };

    if (collectionName === 'students') {
      return checkDedicated('students', 'students');
    } else if (collectionName === 'classrooms' || collectionName === 'classes') {
      return checkDedicated('classrooms', 'classrooms');
    } else if (collectionName === 'programs') {
      return checkDedicated('programs', 'programs');
    } else if (collectionName === 'attendance') {
      return checkDedicated('attendance', 'attendance');
    } else if (collectionName === 'teachers') {
      return checkDedicated('teachers', 'teachers');
    } else if (collectionName === 'enrollments') {
      return checkDedicated('enrollments', 'enrollments');
    } else if (collectionName === 'student_requests') {
      return checkDedicated('student_requests', 'student_requests');
    } else if (collectionName === 'system_users' || collectionName === 'all_users' || collectionName === 'users') {
      try {
        const [uRows]: any = await pool.query(
          `SELECT * FROM all_users WHERE id = ? OR UPPER(username) = UPPER(?) LIMIT 1`,
          [id, id]
        );
        if (uRows && uRows.length > 0) {
          const mergedList = mergeDedicatedAndDocumentRows('system_users', [uRows[0]], appDoc ? [appDoc] : []);
          return mergedList[0] || appDoc;
        }
      } catch (e) {}
    }

    return appDoc;
  },

  // 8. Get Multiple Documents by Candidate IDs (Primary Keys)
  async getDocumentsByIds(collectionName: string, ids: string[]): Promise<any[]> {
    if (!ids || ids.length === 0) return [];
    const pool = getMysqlPool();
    if (!pool) return [];

    let appDocItems: any[] = [];
    try {
      const placeholders = ids.map(() => '?').join(', ');
      const [rows]: any = await pool.query(
        `SELECT id, data FROM app_collections WHERE collection_name = ? AND id IN (${placeholders})`,
        [collectionName, ...ids]
      );
      appDocItems = (rows || []).map((r: any) => {
        const parsed = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        return { ...parsed, id: r.id };
      });
    } catch (e) {}

    const queryDedicatedByIds = async (table: string, colName: string) => {
      try {
        const placeholders = ids.map(() => '?').join(', ');
        const [dRows]: any = await pool.query(
          `SELECT * FROM ${table} WHERE id IN (${placeholders})`,
          ids
        );
        return mergeDedicatedAndDocumentRows(colName, dRows || [], appDocItems);
      } catch (e) {
        return appDocItems;
      }
    };

    if (collectionName === 'students') {
      return queryDedicatedByIds('students', 'students');
    } else if (collectionName === 'classrooms' || collectionName === 'classes') {
      return queryDedicatedByIds('classrooms', 'classrooms');
    } else if (collectionName === 'programs') {
      return queryDedicatedByIds('programs', 'programs');
    } else if (collectionName === 'attendance') {
      return queryDedicatedByIds('attendance', 'attendance');
    } else if (collectionName === 'teachers') {
      return queryDedicatedByIds('teachers', 'teachers');
    } else if (collectionName === 'enrollments') {
      return queryDedicatedByIds('enrollments', 'enrollments');
    } else if (collectionName === 'student_requests') {
      return queryDedicatedByIds('student_requests', 'student_requests');
    } else if (collectionName === 'system_users' || collectionName === 'all_users' || collectionName === 'users') {
      return queryDedicatedByIds('all_users', 'system_users');
    }

    return appDocItems;
  },

  // 9. Query Documents with Dedicated Table Sync & Priority Merge
  async queryCollection(collectionName: string): Promise<any[]> {
    const pool = getMysqlPool();
    if (!pool) return [];

    const startTime = Date.now();
    let appDocItems: any[] = [];
    try {
      const [rows]: any = await pool.execute(
        `SELECT id, data FROM app_collections WHERE collection_name = ? ORDER BY updated_at DESC`,
        [collectionName]
      );
      appDocItems = (rows || []).map((r: any) => {
        const parsed = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        return { ...parsed, id: r.id };
      });
    } catch (e: any) {
      console.warn(`[queryCollection app_collections notice] ${collectionName}:`, e?.message || e);
    }

    const queryDedicatedAll = async (table: string, colName: string) => {
      try {
        const [dRows]: any = await pool.query(`SELECT * FROM ${table} ORDER BY updated_at DESC`);
        return mergeDedicatedAndDocumentRows(colName, dRows || [], appDocItems);
      } catch (e) {
        return appDocItems;
      }
    };

    let result = appDocItems;
    if (collectionName === 'students') {
      result = await queryDedicatedAll('students', 'students');
    } else if (collectionName === 'classrooms' || collectionName === 'classes') {
      result = await queryDedicatedAll('classrooms', 'classrooms');
    } else if (collectionName === 'programs') {
      result = await queryDedicatedAll('programs', 'programs');
    } else if (collectionName === 'attendance') {
      result = await queryDedicatedAll('attendance', 'attendance');
    } else if (collectionName === 'teachers') {
      result = await queryDedicatedAll('teachers', 'teachers');
    } else if (collectionName === 'enrollments') {
      result = await queryDedicatedAll('enrollments', 'enrollments');
    } else if (collectionName === 'student_requests') {
      result = await queryDedicatedAll('student_requests', 'student_requests');
    } else if (collectionName === 'system_users' || collectionName === 'all_users' || collectionName === 'users') {
      result = await queryDedicatedAll('all_users', 'system_users');
    }

    const duration = Date.now() - startTime;
    if (duration > 1000) {
      logSlowQuery(collectionName, duration, `SELECT id, data FROM app_collections WHERE collection_name = '${collectionName}' ORDER BY updated_at DESC`);
    }

    return result;
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

  const id = `login_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const sql = `INSERT INTO login_audit_log (id, username, success, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, NOW())`;
  const params = [id, log.username.trim().toUpperCase(), log.success ? 1 : 0, log.ipAddress, log.userAgent || ''];

  try {
    await pool.execute(sql, params);
  } catch (err: any) {
    if (err?.code === 'ER_NO_SUCH_TABLE' || err?.message?.includes("doesn't exist")) {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`login_audit_log\` (
            \`id\` VARCHAR(100) NOT NULL,
            \`username\` VARCHAR(150) NOT NULL,
            \`success\` TINYINT(1) NOT NULL DEFAULT 0,
            \`ip_address\` VARCHAR(50) NULL,
            \`user_agent\` TEXT NULL,
            \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            INDEX \`idx_login_username\` (\`username\`),
            INDEX \`idx_login_created_at\` (\`created_at\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        await pool.execute(sql, params);
      } catch (retryErr: any) {
        console.warn('[Login Audit DB Notice Retry Fail]:', retryErr?.message || retryErr);
      }
    } else {
      console.warn('[Login Audit DB Notice]:', err?.message || err);
    }
  }
}
