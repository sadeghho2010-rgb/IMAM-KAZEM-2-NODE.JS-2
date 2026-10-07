import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function resetAllPasswords() {
  const newPassword = process.env.NEW_RESET_PASSWORD || '8411924As';
  console.log(`[Password Reset Script] Hashing target password: "${newPassword}"...`);

  const saltRounds = 10;
  const hash = await bcrypt.hash(newPassword, saltRounds);

  const connectionConfig = {
    host: process.env.MYSQL_HOST || process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || process.env.DB_PORT || process.env.MYSQLPORT || '3306', 10),
    user: process.env.MYSQL_USER || process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.MYSQL_DATABASE || process.env.DB_DATABASE || process.env.MYSQLDATABASE || 'madrasah_db',
  };

  const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
  if (dbUrl) {
    console.log(`[Password Reset Script] Connecting via connection string: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
  } else {
    console.log(`[Password Reset Script] Connecting to MySQL at ${connectionConfig.host}:${connectionConfig.port}, db: ${connectionConfig.database}, user: ${connectionConfig.user}`);
  }

  let connection;
  try {
    connection = dbUrl ? await mysql.createConnection(dbUrl) : await mysql.createConnection(connectionConfig);

    console.log('[Password Reset Script] Connected successfully to MySQL.');

    // 1. Update all records in system_users
    const [userUpdateResult]: any = await connection.execute(
      `UPDATE system_users SET password_hash = ?, must_change_password = 0`,
      [hash]
    );

    let updatedCount = userUpdateResult.affectedRows || 0;

    // Check if SADEGH exists, if not insert
    const [adminCheck]: any = await connection.execute(
      `SELECT id FROM system_users WHERE UPPER(username) = 'SADEGH' LIMIT 1`
    );

    if (!adminCheck || adminCheck.length === 0) {
      const allTabsJson = JSON.stringify([
        'todos', 'workflow', 'academic-calendar', 'presence-hours', 'finance', 'students', 'active-students',
        'discussion', 'programs', 'classrooms', 'student-schedule', 'teachers-schedule', 'stats', 'research',
        'attendance', 'course-selection', 'comments', 'summary', 'teachers-bank', 'backup', 'user-management', 'user-credentials', 'audit-logs'
      ]);
      await connection.execute(`
        INSERT INTO system_users (
          id, username, password_hash, name, role, role_title, level, grade_label,
          mentor_id, avatar_bg, allowed_tabs, editable_tabs, is_active, must_change_password
        ) VALUES (
          'user_sadegh', 'SADEGH', ?, 'صادق (سوپر ادمین)', 'super_admin', 'سوپر ادمین (مدیر کل سیستم)',
          1, 'کل سیستم', 'shahpoori', 'bg-indigo-700', ?, ?, 1, 0
        )
      `, [hash, allTabsJson, allTabsJson]);
      updatedCount += 1;
      console.log(`✨ کاربر سوپر ادمین SADEGH که وجود نداشت با موفقیت ایجاد شد.`);
    }

    console.log(`\n==================================================`);
    console.log(`✅ [SUCCESS] Reset password for ${updatedCount} user(s) in "system_users".`);
    console.log(`   New password set to: "${newPassword}"`);
    console.log(`   must_change_password flag set to: 0 (direct login enabled)`);
    console.log(`==================================================\n`);

    // 2. Invalidate active sessions or refresh tokens if tables exist
    try {
      const [tables] = await connection.execute(`SHOW TABLES LIKE 'user_sessions'`);
      if (Array.isArray(tables) && tables.length > 0) {
        const [sessionResult] = await connection.execute(`DELETE FROM user_sessions`);
        console.log(`🧹 Invalidated ${sessionResult.affectedRows || 0} active session(s) in "user_sessions".`);
      }
    } catch (e) {
      // Table might not exist, proceed
    }

    try {
      const [tables] = await connection.execute(`SHOW TABLES LIKE 'refresh_tokens'`);
      if (Array.isArray(tables) && tables.length > 0) {
        const [tokenResult] = await connection.execute(`DELETE FROM refresh_tokens`);
        console.log(`🧹 Invalidated ${tokenResult.affectedRows || 0} refresh token(s) in "refresh_tokens".`);
      }
    } catch (e) {
      // Table might not exist, proceed
    }

  } catch (error) {
    console.error('❌ [ERROR] Password reset failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('[Password Reset Script] Database connection closed.');
    }
  }
}

resetAllPasswords();
