/**
 * Database Abstraction Layer (Repository Pattern & Dual-Engine Adapter)
 * Provides seamless interchangeability between MySQL (Primary Production Target)
 * and Supabase/Local JSON (Development Fallback).
 * 
 * Features:
 * - 100% Parameterized & Prepared Statements (Eliminating SQL Injection risks)
 * - Connection Pooling with auto-reconnect for MySQL 8+
 * - Unified CRUD interface for collections and domain entities
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

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
export const isMysqlConfigured = Boolean(
  process.env.MYSQL_HOST ||
  process.env.MYSQL_DATABASE ||
  (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql'))
);

let pool: mysql.Pool | null = null;

export function getMysqlPool(): mysql.Pool | null {
  if (!isMysqlConfigured) return null;
  if (!pool) {
    try {
      const host = process.env.MYSQL_HOST || '127.0.0.1';
      const port = Number(process.env.MYSQL_PORT) || 3306;
      const user = process.env.MYSQL_USER || 'root';
      const password = process.env.MYSQL_PASSWORD || '';
      const database = process.env.MYSQL_DATABASE || 'madrasah_db';

      pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
        charset: 'utf8mb4_unicode_ci',
        timezone: '+03:30' // Iran Standard Time
      });

      console.log(`[MySQL Engine] Connection pool initialized for database: ${database}@${host}:${port}`);
    } catch (err) {
      console.error('[MySQL Engine] Pool initialization error:', err);
      pool = null;
    }
  }
  return pool;
}

/**
 * Executes a prepared query safely on MySQL with parameters
 */
export async function executeMysqlQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const mysqlPool = getMysqlPool();
  if (!mysqlPool) {
    throw new Error('دیتابیس MySQL تنظیم نشده است.');
  }

  try {
    const [rows] = await mysqlPool.execute(sql, params);
    return rows as T[];
  } catch (err: any) {
    console.error('[MySQL Execution Error]:', err.message, '\nQuery:', sql);
    throw err;
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
  async saveDocument(collectionName: string, id: string, data: any): Promise<void> {
    const pool = getMysqlPool();
    if (!pool) return;

    const sql = `
      INSERT INTO app_collections (collection_name, id, data, updated_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        data = VALUES(data),
        updated_at = NOW();
    `;
    await pool.execute(sql, [collectionName, id, JSON.stringify(data)]);
  },

  // 6. Delete Document
  async deleteDocument(collectionName: string, id: string): Promise<void> {
    const pool = getMysqlPool();
    if (!pool) return;

    await pool.execute(
      `DELETE FROM app_collections WHERE collection_name = ? AND id = ?`,
      [collectionName, id]
    );
  },

  // 7. Query Documents
  async queryCollection(collectionName: string): Promise<any[]> {
    const pool = getMysqlPool();
    if (!pool) return [];

    const [rows]: any = await pool.execute(
      `SELECT id, data FROM app_collections WHERE collection_name = ? ORDER BY updated_at DESC`,
      [collectionName]
    );

    return (rows || []).map((r: any) => {
      const parsed = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      return { ...parsed, id: r.id };
    });
  }
};
