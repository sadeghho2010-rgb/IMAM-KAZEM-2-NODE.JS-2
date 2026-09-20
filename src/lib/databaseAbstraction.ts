/**
 * Database Abstraction Layer (Repository Pattern)
 * Provides seamless interchangeability between Supabase and MySQL/PostgreSQL
 * with guaranteed prepared statement execution to eliminate SQL Injection.
 */

export interface SystemUserEntity {
  id: string;
  username: string;
  passwordHash: string;
  name?: string;
  role: string;
  level: number;
  roleTitle?: string;
  allowedTabs?: string[];
  mustChangePassword?: boolean;
  failedLoginAttempts?: number;
  accountLockedUntil?: string;
  lastLogin?: string;
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

export interface IUserRepository {
  findByUsername(username: string): Promise<SystemUserEntity | null>;
  findById(id: string): Promise<SystemUserEntity | null>;
  getAll(): Promise<SystemUserEntity[]>;
  save(user: SystemUserEntity): Promise<void>;
  updateRole(userId: string, newRole: string, newLevel: number): Promise<void>;
}

export interface IAuditLogRepository {
  record(log: AuditLogEntity): Promise<void>;
  getRecent(limit: number): Promise<AuditLogEntity[]>;
}

/**
 * MySQL Implementation Specification (Prepared Statements)
 * 
 * Example SQL:
 * 1. findByUsername:
 *    SELECT id, username, password_hash, role, level, must_change_password 
 *    FROM system_users WHERE username = ? LIMIT 1;
 * 
 * 2. save (INSERT ... ON DUPLICATE KEY UPDATE):
 *    INSERT INTO system_users (id, username, password_hash, role, level, last_login)
 *    VALUES (?, ?, ?, ?, ?, ?)
 *    ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), level = VALUES(level), last_login = VALUES(last_login);
 * 
 * 3. recordAuditLog:
 *    INSERT INTO audit_logs (id, user_id, username, action, entity_type, entity_id, description, ip_address, created_at)
 *    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW());
 */
