import { getMysqlPool, MysqlRepository } from '../src/lib/databaseAbstraction';
import { fetchAllUsersFromStorage, deleteUserFromStorage } from '../src/lib/serverAuth';
import fs from 'fs';
import path from 'path';

async function runPurge() {
  console.log('=== STARTING COMPLETE DATA PURGE ===');

  const collectionsToWipe = [
    'students',
    'programs',
    'teachers',
    'enrollments',
    'course_enrollments',
    'study_daily_entries',
    'periodic_study_logs',
    'student_course_progress',
    'discussion_groups',
    'representative_notes',
    'oral_exams',
    'oral_exam_records'
  ];

  // 1. Wipe collections from MySQL database if configured
  const pool = getMysqlPool();
  if (pool) {
    for (const col of collectionsToWipe) {
      try {
        console.log(`Clearing MySQL table/collection: ${col}...`);
        await pool.execute(`DELETE FROM app_collections WHERE collection_name = ?`, [col]);
        // Also clear dedicated tables if they exist
        try {
          await pool.execute(`DELETE FROM \`${col}\``);
        } catch (e) {
          // Table might not exist or might be mapped differently, ignoring
        }
      } catch (err: any) {
        console.warn(`Notice clearing MySQL collection ${col}:`, err?.message || err);
      }
    }
  }

  // 2. Wipe collections from local app_collections.json file
  const appCollectionsPath = path.join(process.cwd(), 'data', 'app_collections.json');
  if (fs.existsSync(appCollectionsPath)) {
    try {
      const raw = fs.readFileSync(appCollectionsPath, 'utf-8');
      const store = JSON.parse(raw);
      for (const col of collectionsToWipe) {
        if (store[col]) {
          delete store[col];
        }
      }
      fs.writeFileSync(appCollectionsPath, JSON.stringify(store, null, 2), 'utf-8');
      console.log('Cleared target collections from data/app_collections.json');
    } catch (e) {
      console.warn('Notice clearing data/app_collections.json:', e);
    }
  }

  // 3. Purge Level 3 users and student accounts from system_users
  try {
    const allUsers = await fetchAllUsersFromStorage();
    console.log(`Total users in system before purge: ${allUsers.length}`);

    const usersToKeep = allUsers.filter(u => {
      const isLevel1or2 = u.level === 1 || u.level === 2;
      const isStudent = u.level === 3 || u.role === 'student' || u.role === 'class_representative' || u.role === 'student_rep';
      return isLevel1or2 && !isStudent;
    });

    console.log(`Users remaining after purge (Level 1 & Level 2 only): ${usersToKeep.length}`);

    // Update system_users.json file
    const usersFilePath = path.join(process.cwd(), 'data', 'system_users.json');
    fs.writeFileSync(usersFilePath, JSON.stringify(usersToKeep, null, 2), 'utf-8');

    // Update MySQL system_users / all_users tables
    if (pool) {
      try {
        await pool.execute(`DELETE FROM app_collections WHERE collection_name IN ('system_users', 'users', 'all_users')`);
        for (const u of usersToKeep) {
          await pool.execute(
            `INSERT INTO app_collections (collection_name, id, data, updated_at) VALUES ('system_users', ?, ?, NOW()) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()`,
            [u.id, JSON.stringify(u)]
          );
        }
        try {
          await pool.execute(`DELETE FROM system_users WHERE level = 3 OR role IN ('student', 'class_representative', 'student_rep')`);
        } catch (e) {}
      } catch (e) {
        console.warn('Notice syncing users to MySQL:', e);
      }
    }
  } catch (err: any) {
    console.error('Error purging users:', err);
  }

  console.log('=== DATA PURGE COMPLETED SUCCESSFULLY ===');
  process.exit(0);
}

runPurge().catch(err => {
  console.error('Fatal purge error:', err);
  process.exit(1);
});
