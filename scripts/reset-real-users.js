import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

function generateRandomPassword(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

async function resetRealUsers() {
  console.log('==================================================');
  console.log('🔒 REAL USERS RANDOM PASSWORD GENERATOR & RESET');
  console.log('==================================================\n');

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
    console.log('✅ Connected to MySQL database successfully.\n');

    const [users] = await connection.execute(`SELECT id, username, name FROM system_users ORDER BY username ASC`);

    if (!Array.isArray(users) || users.length === 0) {
      console.log('⚠️ No users found in "system_users" table.');
      return;
    }

    const saltRounds = 10;
    const generatedCredentials = [];

    console.log(`Processing ${users.length} user(s)... Generating unique 10-char random passwords...\n`);

    for (const u of users) {
      const plainPassword = generateRandomPassword(10);
      const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

      await connection.execute(
        `UPDATE system_users SET password_hash = ?, must_change_password = 1 WHERE id = ?`,
        [passwordHash, u.id]
      );

      generatedCredentials.push({
        'نام کاربری (Username)': u.username,
        'نام کاربر': u.name || u.username,
        'رمز عبور تصادفی (New Password)': plainPassword,
        'اجبار تغییر رمز': 'بله (1)'
      });
    }

    try {
      await connection.execute(`DELETE FROM user_sessions`);
    } catch (e) {}
    try {
      await connection.execute(`DELETE FROM refresh_tokens`);
    } catch (e) {}

    console.log('========================================================================================');
    console.log('🔑 جدول رمزهای جدید کاربران تولید شده (این اطلاعات را فقط همین یک بار ذخیره کنید!):');
    console.log('========================================================================================\n');
    console.table(generatedCredentials);
    console.log('\n========================================================================================');
    console.log(`✅ [COMPLETE] Successfully updated ${generatedCredentials.length} user(s). All active sessions invalidated.`);
    console.log('   All users MUST change their password upon first login.');
    console.log('========================================================================================\n');

  } catch (error) {
    console.error('❌ [ERROR] Failed to reset users:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed.');
    }
  }
}

resetRealUsers();
