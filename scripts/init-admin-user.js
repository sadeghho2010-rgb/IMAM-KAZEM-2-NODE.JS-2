import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function initAdminUser() {
  const newPassword = process.env.INITIAL_ADMIN_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD || process.argv[2] || 'Sadegh1370#Secure';
  
  console.log('====================================================');
  console.log('🛡️  SUPER ADMIN ACCOUNT INITIALIZATION / RESET SCRIPT');
  console.log('====================================================\n');

  console.log(`🔑 Target Username: "SADEGH"`);
  console.log(`🔑 Target Plain Password: "${newPassword}"`);

  if (!newPassword || newPassword.length < 8) {
    console.error('❌ ERROR: Admin password must be at least 8 characters long.');
    process.exit(1);
  }

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
  let connection;

  try {
    connection = dbUrl ? await mysql.createConnection(dbUrl) : await mysql.createConnection(connectionConfig);
    console.log('✅ Connected to MySQL database successfully.');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS system_users (
        id VARCHAR(100) NOT NULL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NULL,
        name VARCHAR(150) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'super_admin',
        role_title VARCHAR(100) NULL,
        level INT NOT NULL DEFAULT 1,
        grade_label VARCHAR(100) NULL,
        mentor_id VARCHAR(100) NULL,
        student_id VARCHAR(100) NULL,
        linked_student_id VARCHAR(100) NULL,
        avatar_bg VARCHAR(50) NULL,
        allowed_tabs JSON NULL,
        editable_tabs JSON NULL,
        module_permissions JSON NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        must_change_password TINYINT(1) NOT NULL DEFAULT 0,
        failed_login_attempts INT NOT NULL DEFAULT 0,
        account_locked_until DATETIME NULL,
        last_login DATETIME NULL,
        data JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const adminUser = {
      id: 'user_sadegh',
      username: 'SADEGH',
      password_hash: hash,
      name: 'صادق (سوپر ادمین)',
      role: 'super_admin',
      role_title: 'سوپر ادمین (مدیر کل سیستم)',
      level: 1,
      grade_label: 'کل سیستم',
      mentor_id: 'shahpoori',
      is_active: 1,
      must_change_password: 0
    };

    await connection.execute(`
      INSERT INTO system_users (
        id, username, password_hash, name, role, role_title, level, grade_label, mentor_id, is_active, must_change_password
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        name = VALUES(name),
        role = VALUES(role),
        role_title = VALUES(role_title),
        level = VALUES(level),
        grade_label = VALUES(grade_label),
        is_active = 1,
        must_change_password = 0,
        failed_login_attempts = 0,
        account_locked_until = NULL,
        updated_at = NOW();
    `, [
      adminUser.id,
      adminUser.username,
      adminUser.password_hash,
      adminUser.name,
      adminUser.role,
      adminUser.role_title,
      adminUser.level,
      adminUser.grade_label,
      adminUser.mentor_id,
      adminUser.is_active,
      adminUser.must_change_password
    ]);

    console.log('\n====================================================');
    console.log('✅ SUCCESS! Super Admin "SADEGH" account initialized/updated.');
    console.log(`   Username: SADEGH`);
    console.log(`   Password: ${newPassword}`);
    console.log(`   Bcrypt Hash: ${hash.substring(0, 25)}...`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('❌ ERROR initializing admin user:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed.');
    }
  }
}

initAdminUser();
