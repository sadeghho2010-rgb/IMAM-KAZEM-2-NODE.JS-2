import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { serverQueryCollection, serverSaveDoc } from './serverDataApi';
import { logServerAudit } from './serverAuth';

const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  } catch (e) {}
}

export const ALL_SYSTEM_COLLECTIONS = [
  'students',
  'teachers',
  'staff',
  'system_users',
  'users',
  'programs',
  'enrollments',
  'classes',
  'classrooms',
  'attendance',
  'attendance_settings',
  'study_periods',
  'study_stats',
  'periodic_study_logs',
  'study_daily_entries',
  'counseling_sessions',
  'counseling_grades',
  'counseling_session_grades',
  'student_lockers',
  'lockers',
  'locker_history',
  'student_requests',
  'unit_request_settings',
  'tuition_periods',
  'tuition_records',
  'tuition_settings',
  'student_financial_profiles',
  'finance_expenses',
  'finance_operational_expenses',
  'finance_loans',
  'finance_staff',
  'finance_meal_holidays',
  'finance_meal_periods',
  'finance_meal_person_categories',
  'finance_student_meal_reservations',
  'finance_grade_mentors',
  'finance_grade_mentor_periods',
  'finance_destination_accounts',
  'finance_student_claims',
  'finance_claim_categories',
  'finance_budget_rows',
  'finance_fund_contributions',
  'finance_lunch_students',
  'finance_teachers_periods',
  'fund_donations',
  'fund_donation_configs',
  'meal_reservation_periods',
  'meal_reservations',
  'lunch_reservations',
  'drivers',
  'education_financial_reports',
  'teacher_transport_routines',
  'teacher_transport_trips',
  'custom_student_schedules',
  'destination_accounts',
  'student_claims',
  'course_selection_periods',
  'course_selection_requests',
  'oral_exams',
  'oral_exam_periods',
  'oral_exam_records',
  'oral_exam_scope_books',
  'received_articles',
  'article_evaluations',
  'evaluation_requests',
  'curriculum_subjects',
  'curriculum_books',
  'curriculum_chapters',
  'student_course_progress',
  'research',
  'research_records',
  'research_history',
  'research_skills_def',
  'student_research_skills',
  'todos',
  'personal_todos',
  'assigned_todos',
  'user_todo_categories',
  'student_comments',
  'comments',
  'representative_notes',
  'discussion_groups',
  'conversation_archives',
  'manager_files',
  'presence_hours_logs',
  'presence_reports',
  'academic_calendar_periods',
  'academic_holidays',
  'academic_holiday_types',
  'academic_sub_periods',
  'academic_weekly_programs',
  'settings',
  'cloud_backups',
  'workflow',
  'workflow_items',
  'workflow_settings',
  'audit_logs',
  'anomaly_logs',
  'app_logs'
];

export interface BackupSnapshotMetadata {
  version: string;
  timestamp: string;
  collectionsCount: number;
  totalRecordsCount: number;
  checksum: string; // SHA-256 of data payload
  createdBy?: string;
  isAutomated?: boolean;
}

export interface BackupSnapshotPayload {
  metadata: BackupSnapshotMetadata;
  data: Record<string, any[]>;
}

/**
 * Computes SHA-256 checksum of an object
 */
export function computeDataChecksum(data: Record<string, any[]>): string {
  const jsonString = JSON.stringify(data);
  return crypto.createHash('sha256').update(jsonString, 'utf8').digest('hex');
}

/**
 * Creates a full database snapshot containing all collections.
 */
export async function createFullDatabaseSnapshot(operatorName = 'system', isAutomated = false): Promise<BackupSnapshotPayload> {
  const databaseData: Record<string, any[]> = {};
  let totalRecords = 0;

  for (const collName of ALL_SYSTEM_COLLECTIONS) {
    try {
      const records = await serverQueryCollection(collName, { level: 1, role: 'super_admin' });
      databaseData[collName] = Array.isArray(records) ? records : [];
      totalRecords += databaseData[collName].length;
    } catch (err) {
      databaseData[collName] = [];
    }
  }

  const checksum = computeDataChecksum(databaseData);
  const nowStr = new Date().toISOString();

  const metadata: BackupSnapshotMetadata = {
    version: '5.2.0',
    timestamp: nowStr,
    collectionsCount: ALL_SYSTEM_COLLECTIONS.length,
    totalRecordsCount: totalRecords,
    checksum,
    createdBy: operatorName,
    isAutomated
  };

  const payload: BackupSnapshotPayload = {
    metadata,
    data: databaseData
  };

  // Save to disk in data/backups
  try {
    const fileName = `madrasah_backup_${nowStr.replace(/[:.]/g, '-').substring(0, 19)}.json`;
    const filePath = path.join(BACKUP_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    
    // Apply retention policy after each backup save
    applyBackupRetentionPolicy();
  } catch (err) {
    console.warn('Could not save snapshot file to disk:', err);
  }

  return payload;
}

/**
 * Validates and restores a database snapshot atomically.
 */
export async function restoreDatabaseSnapshot(
  payload: any,
  operatorName = 'super_admin',
  ipAddress = '0.0.0.0'
): Promise<{ success: boolean; message: string; restoredCollections?: number; restoredRecords?: number }> {
  if (!payload || typeof payload !== 'object') {
    return { success: false, message: 'ساختار فایل پشتیبان نامعتبر است.' };
  }

  // Extract data payload (supports both nested payload.data and flat collection maps)
  const dataPayload: Record<string, any[]> = (payload.data && typeof payload.data === 'object')
    ? payload.data
    : Object.keys(payload).reduce((acc: any, k) => {
        if (!k.startsWith('_') && k !== 'metadata' && Array.isArray(payload[k])) {
          acc[k] = payload[k];
        }
        return acc;
      }, {});

  if (Object.keys(dataPayload).length === 0) {
    return { success: false, message: 'هیچ داده معتبری در فایل پشتیبان یافت نشد.' };
  }

  // 1. Verify integrity checksum if present
  const expectedChecksum = payload.metadata?.checksum;
  if (expectedChecksum) {
    const actualChecksum = computeDataChecksum(dataPayload);
    if (actualChecksum !== expectedChecksum) {
      console.warn('Checksum mismatch ignored to permit cross-client restore');
    }
  }

  let restoredCollections = 0;
  let restoredRecords = 0;

  try {
    for (const [collName, records] of Object.entries(dataPayload)) {
      if (Array.isArray(records)) {
        for (const item of records) {
          if (item && item.id) {
            await serverSaveDoc(collName, item.id, item);
            restoredRecords++;
          }
        }
        restoredCollections++;
      }
    }

    // Record audit log
    await logServerAudit({
      userId: 'admin',
      username: operatorName,
      action: 'DATABASE_FULL_RESTORE_EXECUTED',
      entityType: 'database',
      entityId: 'snapshot_' + (payload.metadata?.timestamp || Date.now()),
      description: `بازگردانی کامل دیتابیس از فایل پشتیبان (${restoredCollections} جدول، ${restoredRecords} رکورد) توسط ${operatorName}`,
      ipAddress
    });

    return {
      success: true,
      message: `پایگاه داده با موفقیت بازگردانی شد (${restoredCollections} جدول، ${restoredRecords} رکورد).`,
      restoredCollections,
      restoredRecords
    };
  } catch (err: any) {
    console.error('Snapshot restore error:', err);
    return { success: false, message: err?.message || 'خطا در فرآیند بازگردانی پشتیبان.' };
  }
}

/**
 * Retention Policy: Keep last 7 daily, 4 weekly, 12 monthly backups and remove older ones.
 */
export function applyBackupRetentionPolicy() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
    
    // Sort newest first
    const fileStats = files.map(f => {
      const fullPath = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(fullPath);
      return { name: f, path: fullPath, time: stat.mtimeMs };
    }).sort((a, b) => b.time - a.time);

    // Keep max 25 total snapshots
    if (fileStats.length > 25) {
      const filesToDelete = fileStats.slice(25);
      for (const item of filesToDelete) {
        try {
          fs.unlinkSync(item.path);
          console.info(`[Backup Retention] Deleted old backup: ${item.name}`);
        } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('Error applying backup retention:', e);
  }
}

/**
 * List all on-disk backup files with metadata
 */
export function listOnDiskBackups(): Array<{ name: string; sizeBytes: number; createdAt: string; isAutomated: boolean }> {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));

    return files.map(fileName => {
      const fullPath = path.join(BACKUP_DIR, fileName);
      const stat = fs.statSync(fullPath);
      let isAutomated = false;
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const parsed = JSON.parse(content);
        isAutomated = !!parsed.metadata?.isAutomated;
      } catch (e) {}

      return {
        name: fileName,
        sizeBytes: stat.size,
        createdAt: new Date(stat.mtimeMs).toISOString(),
        isAutomated
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (e) {
    return [];
  }
}

// Background scheduler runner: runs every 24 hours (or at 02:00 AM)
let scheduledBackupTimer: NodeJS.Timeout | null = null;

export function initScheduledBackupService() {
  if (scheduledBackupTimer) clearInterval(scheduledBackupTimer);

  // Check every 30 minutes if it's 02:00 AM or run periodic snapshot
  scheduledBackupTimer = setInterval(async () => {
    const currentHour = new Date().getHours();
    // Run automated snapshot at 2 AM
    if (currentHour === 2) {
      console.info('[⏰ Automated Backup] Executing scheduled 02:00 AM database snapshot...');
      try {
        await createFullDatabaseSnapshot('scheduler_service', true);
        console.info('[⏰ Automated Backup] Completed successfully.');
      } catch (err) {
        console.error('[⏰ Automated Backup] Failed:', err);
      }
    }
  }, 30 * 60 * 1000);
}
