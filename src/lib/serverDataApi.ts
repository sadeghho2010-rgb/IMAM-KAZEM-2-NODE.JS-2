import { Request, Response } from 'express';
import { verifyAccessToken, logServerAudit, StoredUser, fetchAllUsersFromStorage, saveUserToStorage, deleteUserFromStorage, evictUserFromMemoryStores, purgeAllStudentUsersFromStorage } from './serverAuth';
import { isMysqlConfigured, MysqlRepository } from './databaseAbstraction';
import { logAudit } from './auditLogger';
import { normalizeShamsiDateStr, getConsolidatedSessionLog, toEnglishDigits } from './jalali';
import {
  computePeriodAutoAnnouncementUpdate,
  getMealPeriodAnnouncementId,
  getStudyPeriodAnnouncementId
} from './autoAnnouncementHelper';

// Real-time synchronization event bus & change log buffer
export interface ServerChangeEvent {
  collection: string;
  id: string;
  action: 'upsert' | 'delete';
  timestamp: number;
}

type RealtimeListener = (event: ServerChangeEvent) => void;
const realtimeListeners = new Set<RealtimeListener>();
const recentChangesBuffer: ServerChangeEvent[] = [];
const MAX_RECENT_CHANGES = 500;

// High-performance L1 In-Memory Cache with instant invalidation on writes
interface CacheEntry {
  data: any[];
  timestamp: number;
}
const rawCollectionCache = new Map<string, CacheEntry>();
const RAW_CACHE_TTL_MS = 25 * 1000; // 25s TTL

export function invalidateCollectionCache(collection?: string) {
  if (collection) {
    rawCollectionCache.delete(collection);
    if (collection === 'users' || collection === 'all_users' || collection === 'system_users') {
      rawCollectionCache.delete('users');
      rawCollectionCache.delete('all_users');
      rawCollectionCache.delete('system_users');
    }
    if (collection === 'classrooms' || collection === 'classes') {
      rawCollectionCache.delete('classrooms');
      rawCollectionCache.delete('classes');
    }
  } else {
    rawCollectionCache.clear();
  }
}

export function getRecentChangesSince(timestamp: number): ServerChangeEvent[] {
  const ts = Number(timestamp) || 0;
  return recentChangesBuffer.filter(c => c.timestamp > ts);
}

export function registerRealtimeListener(listener: RealtimeListener): () => void {
  realtimeListeners.add(listener);
  return () => realtimeListeners.delete(listener);
}

export function notifyRealtimeChange(collection: string, id: string, action: 'upsert' | 'delete') {
  invalidateCollectionCache(collection);
  const evt: ServerChangeEvent = { collection, id, action, timestamp: Date.now() };
  recentChangesBuffer.push(evt);
  if (recentChangesBuffer.length > MAX_RECENT_CHANGES) {
    recentChangesBuffer.shift();
  }
  realtimeListeners.forEach(fn => {
    try { fn(evt); } catch (e) {}
  });
}

// Mapping between logical collection names and dedicated PostgreSQL/MySQL tables
export const COLLECTION_TABLE_MAP: Record<string, string> = {
  all_users: 'all_users',
  system_users: 'system_users',
  users: 'system_users',
  students: 'students',
  teachers: 'teachers',
  classrooms: 'classrooms',
  classes: 'classrooms',
  programs: 'programs',
  enrollments: 'enrollments',
  attendance: 'attendance',
  study_periods: 'study_periods',
  study_stats: 'study_stats',
  periodic_study_logs: 'periodic_study_logs',
  study_daily_entries: 'study_daily_entries',
  discussion_groups: 'discussion_groups',
  research: 'research',
  research_records: 'research',
  received_articles: 'received_articles',
  article_evaluations: 'article_evaluations',
  evaluation_requests: 'evaluation_requests',
  tuition_periods: 'tuition_periods',
  tuition_records: 'tuition_records',
  finance_loans: 'finance_loans',
  finance_expenses: 'finance_expenses',
  finance_operational_expenses: 'finance_expenses',
  personal_todos: 'personal_todos',
  assigned_todos: 'assigned_todos',
  user_todo_categories: 'user_todo_categories',
  course_selection_periods: 'course_selection_periods',
  course_selection_requests: 'course_selection_requests',
  student_requests: 'student_requests',
  global_requests_config: 'global_requests_config',
  unit_request_settings: 'unit_request_settings',
  student_lockers: 'student_lockers',
  lockers: 'student_lockers',
  audit_logs: 'audit_logs'
};

// Client-side helper functions for direct REST API access
export async function postDataToServer(collection: string, data: any): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') ||
         localStorage.getItem('access_token') || sessionStorage.getItem('access_token') ||
         localStorage.getItem('token') || sessionStorage.getItem('token'))
      : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/data/${collection}`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(data)
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      return { success: true, id: json.id };
    }
    return { success: false, error: json.message || `HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, error: e?.message || 'خطا در ارتباط با سرور' };
  }
}

export async function fetchDataFromServer(collection: string): Promise<{ success: boolean; items?: any[]; error?: string }> {
  try {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') ||
         localStorage.getItem('access_token') || sessionStorage.getItem('access_token') ||
         localStorage.getItem('token') || sessionStorage.getItem('token'))
      : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/data/${collection}`, {
      method: 'GET',
      headers,
      credentials: 'include'
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success && Array.isArray(json.items)) {
      return { success: true, items: json.items };
    }
    return { success: false, error: json.message || `HTTP ${res.status}`, items: [] };
  } catch (e: any) {
    return { success: false, error: e?.message || 'خطا در ارتباط با سرور', items: [] };
  }
}

export async function deleteDataFromServer(collection: string, id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') ||
         localStorage.getItem('access_token') || sessionStorage.getItem('access_token') ||
         localStorage.getItem('token') || sessionStorage.getItem('token'))
      : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/data/${collection}/${id}`, {
      method: 'DELETE',
      headers,
      credentials: 'include'
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      return { success: true };
    }
    return { success: false, error: json.message || `HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, error: e?.message || 'خطا در ارتباط با سرور' };
  }
}

// Sensitive collections requiring elevated finance/admin roles
const FINANCIAL_COLLECTIONS = new Set([
  'tuition_records', 'tuition_periods', 'finance_loans', 'loans', 'finance_expenses',
  'finance_operational_expenses', 'finance_budget_rows', 'finance_student_claims'
]);

const USER_SPECIFIC_COLLECTIONS = new Set([
  'personal_todos', 'user_todo_categories'
]);

const SHARED_SCHOOL_READ_COLLECTIONS = new Set([
  'academic_holidays', 'academic_calendar_periods', 'academic_holiday_types',
  'academic_sub_periods', 'academic_weekly_programs', 'school_events',
  'curriculum_subjects', 'curriculum_books', 'curriculum_chapters',
  'student_portal_access_config', 'settings', 'system_settings',
  'attendance_settings', 'unit_request_settings', 'global_requests_config',
  'programs', 'classrooms', 'classes', 'teachers', 'teacher_schedules',
  'enrollments', 'course_enrollments',
  'study_periods', 'study_stats', 'periodic_study_logs', 'study_daily_entries',
  'course_selection_periods', 'course_selection_requests',
  'meal_periods', 'meal_reservation_periods', 'lunch_periods', 'student_meal_periods',
  'finance_meal_periods', 'finance_meal_holidays', 'finance_meal_person_categories',
  'meal_cancelled_days', 'meal_reservations', 'lunch_reservations',
  'student_meal_reservations', 'finance_student_meal_reservations',
  'oral_exam_periods', 'oral_exam_scope_books', 'oral_exams', 'oral_exam_records',
  'research_skills_def', 'student_research_skills', 'research', 'research_records', 'research_history',
  'article_evaluations', 'received_articles', 'evaluation_requests',
  'discussion_groups', 'conversation_archives',
  'student_course_progress', 'passed_courses',
  'student_lockers', 'lockers', 'locker_history',
  'counseling_sessions', 'counseling_grades', 'counseling_session_grades',
  'student_comments', 'comments',
  'students', 'attendance', 'student_requests',
  'tuition_records',
  'assigned_todos', 'todos', 'workflow_items', 'workflow', 'workflow_settings',
  'representative_notes', 'announcements', 'announcement_dismissals',
  'personal_todos', 'user_todo_categories', 'custom_student_schedules',
  'fund_donations', 'fund_donation_configs',
  'system_section_permissions', 'system_health_config'
]);

const SHARED_METADATA_READ_COLLECTIONS = new Set([
  'academic_holidays', 'academic_calendar_periods', 'academic_holiday_types',
  'academic_sub_periods', 'academic_weekly_programs', 'school_events',
  'curriculum_subjects', 'curriculum_books', 'curriculum_chapters',
  'student_portal_access_config', 'settings', 'system_settings',
  'attendance_settings', 'unit_request_settings', 'global_requests_config',
  'programs', 'classrooms', 'classes', 'teachers', 'teacher_schedules',
  'enrollments', 'course_enrollments',
  'study_periods', 'study_stats',
  'course_selection_periods',
  'meal_periods', 'meal_reservation_periods', 'lunch_periods', 'student_meal_periods',
  'finance_meal_periods', 'finance_meal_holidays', 'finance_meal_person_categories',
  'meal_cancelled_days',
  'oral_exam_periods', 'oral_exam_scope_books',
  'research_skills_def', 'article_evaluations', 'discussion_groups',
  'announcements', 'system_section_permissions', 'representative_notes',
  'fund_donation_configs', 'system_health_config'
]);

const STAFF_OPERATIONAL_COLLECTIONS = new Set([
  ...SHARED_SCHOOL_READ_COLLECTIONS,
  'tuition_periods', 'tuition_settings', 'student_financial_profiles',
  'finance_staff', 'finance_grade_mentors', 'finance_grade_mentor_periods',
  'finance_destination_accounts', 'finance_claim_categories',
  'finance_fund_contributions', 'finance_lunch_students', 'finance_teachers_periods',
  'destination_accounts', 'student_claims', 'education_financial_reports',
  'drivers', 'teacher_transport_routines', 'teacher_transport_trips',
  'staff', 'presence_hours_logs', 'presence_reports', 'manager_files',
  'db_save_errors', 'bug_reports', 'cloud_backups', 'anomaly_logs', 'app_logs'
]);

const STUDENT_WRITABLE_COLLECTIONS = new Set([
  'student_requests',
  'study_daily_entries',
  'periodic_study_logs',
  'course_selection_requests',
  'student_meal_reservations',
  'finance_student_meal_reservations',
  'meal_reservations',
  'lunch_reservations',
  'received_articles',
  'evaluation_requests',
  'custom_student_schedules',
  'personal_todos',
  'user_todo_categories',
  'assigned_todos',
  'workflow_items',
  'announcement_dismissals',
  'attendance',
  'db_save_errors'
]);

const STUDENT_DELETABLE_COLLECTIONS = new Set([
  'personal_todos',
  'user_todo_categories',
  'study_daily_entries',
  'periodic_study_logs',
  'received_articles',
  'custom_student_schedules'
]);

export function isClassRepresentativeUser(user: any): boolean {
  if (!user) return false;
  return Boolean(
    user.role === 'class_representative' ||
    user.isClassRep === true ||
    user.managedClassId ||
    (user.roleTitle && String(user.roleTitle).includes('نماینده')) ||
    (Array.isArray(user.representativeProgramIds) && user.representativeProgramIds.length > 0)
  );
}

export function isStudentLevelUser(user: any): boolean {
  if (!user) return false;
  if (user.role === 'teacher') return false;
  if (Number(user.level) === 1 || Number(user.level) === 2) return false;
  return user.role === 'student' || user.role === 'class_representative' || Number(user.level) === 3;
}

export function isRegularStudentUser(user: any): boolean {
  return isStudentLevelUser(user) && !isClassRepresentativeUser(user);
}

export function getUserIdentityCandidates(user: any): string[] {
  if (!user) return [];
  return Array.from(new Set(
    [
      user.id,
      user.userId,
      user.studentId,
      user.linkedStudentId,
      user.username,
      user.nationalCode,
      user.nationalId
    ]
      .filter(Boolean)
      .map((x: any) => String(x).trim().toLowerCase())
  ));
}

export async function resolveAuthoritativeStudentIdentity(user: any): Promise<{
  studentId: string;
  studentName: string;
  nationalCode: string;
  userId: string;
  candidates: string[];
}> {
  const candidates = getUserIdentityCandidates(user);
  let matchedStudent: any = null;
  try {
    const allStudents = await fetchRawCollectionData('students');
    const uSid = String(user?.studentId || user?.linkedStudentId || '').trim().toLowerCase();
    const uId = String(user?.id || user?.userId || '').trim().toLowerCase();
    const uName = String(user?.username || '').trim().toLowerCase();

    matchedStudent = (allStudents || []).find((s: any) => {
      if (!s) return false;
      const sId = String(s.id || '').trim().toLowerCase();
      const sCode = String(s.studentCode || '').trim().toLowerCase();
      const sNat = String(s.nationalId || s.nationalCode || '').trim().toLowerCase();
      if (uSid && (sId === uSid || sCode === uSid || sNat === uSid)) return true;
      if (uId && sId === uId) return true;
      if (uName && (sCode === uName || sNat === uName || sId === uName)) return true;
      return false;
    });
  } catch {}

  const studentId = String(
    matchedStudent?.id || user?.studentId || user?.linkedStudentId || user?.id || user?.userId || ''
  ).trim();
  const studentName = String(
    matchedStudent?.name || matchedStudent?.fullName || user?.studentName || user?.fullName || user?.name || user?.username || ''
  ).trim();
  const nationalCode = String(
    matchedStudent?.nationalId || matchedStudent?.nationalCode || user?.nationalCode || user?.nationalId || user?.username || ''
  ).trim();
  const userId = String(user?.id || user?.userId || studentId || '').trim();

  const fullCandidates = Array.from(new Set([
    ...candidates,
    studentId.toLowerCase(),
    nationalCode.toLowerCase(),
    matchedStudent?.studentCode ? String(matchedStudent.studentCode).trim().toLowerCase() : ''
  ].filter(Boolean)));

  return { studentId, studentName, nationalCode, userId, candidates: fullCandidates };
}

export function isMatchingStudentEntry(entry: any, candidates: string[], user?: any): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const entryIds = [
    entry.studentId,
    entry.student_id,
    entry.userId,
    entry.user_id,
    entry.nationalId,
    entry.nationalCode,
    entry.studentCode
  ]
    .filter(Boolean)
    .map((v: any) => String(v).trim().toLowerCase());

  if (entryIds.some(eid => candidates.includes(eid))) {
    return true;
  }

  const uName = String(user?.name || user?.fullName || user?.studentName || '').trim().toLowerCase();
  const eName = String(entry.studentName || entry.name || '').trim().toLowerCase();
  if (entryIds.length === 0 && uName && eName && uName === eName) {
    return true;
  }
  return false;
}

// Helper to normalize teacher names for robust matching
function cleanTeacherName(raw: string | undefined | null): string {
  if (!raw) return '';
  let str = String(raw).replace(/\([^)]*\)/g, ' ');
  str = str.replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک').replace(/[ة]/g, 'ه').replace(/[آأإ]/g, 'ا').replace(/[ؤ]/g, 'و').replace(/[ئ]/g, 'ی');
  str = str.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF\u00A0]/g, ' ');
  str = str.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
  const prefixRegex = /^(استاد|حجت\s*الاسلام\s*و\s*المسلمین|حجت\s*الاسلام|ایت\s*الله|شیخ|دکتر|جناب\s*اقای|جناب\s*آقای|اقای|آقای|سید|میر)\s+/g;
  let prev = '';
  while (prev !== str) {
    prev = str;
    str = str.replace(prefixRegex, '').trim();
  }
  return str.replace(/\s+/g, ' ').toLowerCase().trim();
}

// Public collections strictly limited to public calendars, holidays, and approved curriculum bank
const PUBLIC_READ_COLLECTIONS = new Set([
  'academic_holidays',
  'academic_calendar_periods',
  'school_events',
  'curriculum_subjects',
  'curriculum_books',
  'curriculum_chapters',
  'student_portal_access_config'
]);

// Helper to check caller permission
export function authorizeCollectionAccess(
  user: any,
  collection: string,
  action: 'read' | 'write' | 'delete',
  recordOwnerId?: string
): { allowed: boolean; reason?: string } {
  if (!user) {
    if (action === 'read' && PUBLIC_READ_COLLECTIONS.has(collection)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'احراز هویت الزامی است. مشاهده یا ویرایش این داده‌ها نیازمند ورود به سامانه است.' };
  }

  // Announcements: all authenticated users can read; strictly non-read-only Super Admin & Education Officer can write/delete
  if (collection === 'announcements') {
    if (action === 'read') return { allowed: true };
    if (user.isReadOnly === true || user.canEdit === false) {
      return { allowed: false, reason: 'کاربران دارای دسترسی فقط‌مشاهده مجاز به ایجاد یا تغییر اطلاعیه نیستند.' };
    }
    const uName = String(user.username || '').toUpperCase();
    const canManageAnnouncements =
      user.role === 'super_admin' ||
      (user.level === 1 && user.role !== 'school_manager') ||
      user.role === 'education_manager' ||
      user.role === 'education_officer' ||
      uName === 'SADEGH' ||
      uName === 'SHAH' ||
      uName === 'SHAHPOORI';
    if (canManageAnnouncements) return { allowed: true };
    return { allowed: false, reason: 'مدیریت اطلاعیه‌ها منحصراً در اختیار مسئول آموزش و سوپر ادمین است.' };
  }

  // Announcement Dismissals: authenticated users can read/write only their own dismissal records
  if (collection === 'announcement_dismissals') {
    if (action === 'read') return { allowed: true };
    if (action === 'write') {
      const candidateOwnerIds = [user.id, user.studentId, user.linkedStudentId, user.username]
        .filter(Boolean)
        .map((x: any) => String(x).trim().toLowerCase());
      if (!recordOwnerId || candidateOwnerIds.includes(String(recordOwnerId).trim().toLowerCase())) {
        return { allowed: true };
      }
      const uName = String(user.username || '').toUpperCase();
      if (user.role === 'super_admin' || user.role === 'education_manager' || uName === 'SADEGH' || uName === 'SHAH') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'شما فقط مجاز به ثبت وضعیت نمایش اطلاعیه‌های خود هستید.' };
    }
    const uName = String(user.username || '').toUpperCase();
    if (user.role === 'super_admin' || user.role === 'education_manager' || uName === 'SADEGH' || uName === 'SHAH') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'حذف سابقه تایید اطلاعیه مجاز نیست.' };
  }

  // Level 1: Super Admin has full unrestricted access
  if (user.level === 1 || user.role === 'super_admin' || user.role === 'school_manager') {
    return { allowed: true };
  }

  // Student Portal Access Config: Read allowed for all authenticated users; Write allowed for Super Admin & Education Manager
  if (collection === 'student_portal_access_config') {
    if (action === 'read') return { allowed: true };
    const uName = String(user.username || '').toUpperCase();
    const canManageAccess =
      user.level === 1 ||
      user.role === 'super_admin' ||
      user.role === 'school_manager' ||
      user.role === 'education_manager' ||
      user.role === 'education_officer' ||
      uName === 'SHAH' ||
      uName === 'SHAHPOORI' ||
      uName === 'SADEGH';
    if (canManageAccess) return { allowed: true };
    return { allowed: false, reason: 'مدیریت دسترسی بخش‌های طلاب منحصراً در اختیار مسئول آموزش و سوپر ادمین است.' };
  }

  // Student Profiles Access Policy:
  // Level 1 Admin, Education Managers, Education Officers, Grade Mentors, and authorized staff can manage student profiles
  if (collection === 'students' && (action === 'write' || action === 'delete')) {
    const uName = String(user.username || '').toUpperCase();
    const isAuthorizedStaff =
      user.level === 1 ||
      user.role === 'super_admin' ||
      user.role === 'school_manager' ||
      user.role === 'education_manager' ||
      user.role === 'education_officer' ||
      user.role === 'grade_mentor' ||
      user.role === 'class_representative' ||
      Boolean(user.isClassRep) ||
      user.role === 'mentor' ||
      Boolean(user.mentorId) ||
      uName === 'SHAH' ||
      uName === 'SHAHPOORI' ||
      uName === 'SADEGH' ||
      uName === 'RAHNAMA' ||
      (user.level <= 2 && user.canEdit !== false && !user.isReadOnly);

    if (isAuthorizedStaff) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'مدیریت و ایجاد/حذف مشخصات طلاب منحصراً در اختیار واحد آموزش و مسئولان مربوطه است.' };
  }

  // Financial Collections Check
  if (FINANCIAL_COLLECTIONS.has(collection)) {
    const isFinanceStaff = user.role === 'finance_manager' || user.role === 'financial_officer' || user.username?.toUpperCase() === 'MALI';
    if (!isFinanceStaff) {
      // Students can only read their own tuition records
      if (collection === 'tuition_records' && action === 'read' && (user.level === 3 || user.role === 'student')) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'دسترسی به بخش امور مالی برای شما مجاز نیست.' };
    }
    return { allowed: true };
  }

  // User-Specific Collections (Personal Todos, etc.)
  if (USER_SPECIFIC_COLLECTIONS.has(collection)) {
    if (action === 'write' || action === 'delete') {
      if (recordOwnerId && recordOwnerId !== user.id) {
        return { allowed: false, reason: 'شما فقط مجاز به ویرایش یا حذف اطلاعات شخصی خود هستید.' };
      }
    }
    return { allowed: true };
  }

  // Student Requests Protection: Students can read/submit/reply, but ONLY Admins & Unit Officers can delete records
  if (collection === 'student_requests' && action === 'delete') {
    const uName = String(user.username || '').toUpperCase();
    const canDeleteRequests =
      user.level === 1 ||
      user.role === 'super_admin' ||
      user.role === 'school_manager' ||
      user.role === 'education_manager' ||
      user.role === 'education_officer' ||
      user.role === 'finance_manager' ||
      user.role === 'financial_officer' ||
      user.role === 'cultural_officer' ||
      uName === 'SADEGH' ||
      uName === 'SHAH' ||
      uName === 'SHAHPOORI' ||
      uName === 'MALI' ||
      uName === 'RAHNAMA';
    if (!canDeleteRequests) {
      return { allowed: false, reason: 'حذف درخواست‌های ثبت‌شده منحصراً در اختیار مسئولین واحدها و مدیر سامانه است.' };
    }
    return { allowed: true };
  }

  // Research and Article Evaluation
  if (collection === 'received_articles' || collection === 'evaluation_requests') {
    if (isStudentLevelUser(user) && action === 'write') {
      if (recordOwnerId) {
        const candidates = getUserIdentityCandidates(user);
        if (!candidates.includes(String(recordOwnerId).trim().toLowerCase())) {
          return { allowed: false, reason: 'شما فقط مجاز به ثبت اطلاعات پژوهشی خود هستید.' };
        }
      }
      return { allowed: true };
    }
  }

  // System Users Security Check (Strict: Only Level 1 or Authorized Managers)
  if (collection === 'system_users' || collection === 'all_users' || collection === 'users') {
    const uName = String(user.username || '').toUpperCase();
    const isUserManager =
      Number(user.level) === 1 ||
      user.role === 'education_manager' ||
      user.role === 'education_officer' ||
      uName === 'SHAH' ||
      uName === 'SADEGH';
    if (!isUserManager) {
      return { allowed: false, reason: 'مشاهده و مدیریت کاربران سیستم منحصراً در اختیار مدیر ارشد و مسئول آموزش است.' };
    }
    return { allowed: true };
  }

  // Audit Logs (Read and Revert status update allowed for Super Admin and Education Manager)
  if (collection === 'audit_logs') {
    const uName = String(user.username || '').toUpperCase();
    const isAuditAuthorized =
      user.level === 1 ||
      user.role === 'super_admin' ||
      user.role === 'school_manager' ||
      user.role === 'education_manager' ||
      user.role === 'education_officer' ||
      uName === 'SADEGH' ||
      uName === 'SHAH' ||
      uName === 'SHAHPOORI' ||
      uName === 'RAHNAMA';
    if (!isAuditAuthorized) {
      return { allowed: false, reason: 'مشاهده و مدیریت لاگ‌های فعالیت سایت منحصراً در اختیار مدیر ارشد و مسئول آموزش است.' };
    }
    return { allowed: true };
  }

  // Finance Staff (authorized across finance/meal/transport/requests/school-read; FINANCIAL_COLLECTIONS already handled above)
  const uUpper = String(user.username || '').toUpperCase();
  const isFinanceStaff =
    user.role === 'finance_manager' ||
    user.role === 'financial_officer' ||
    uUpper === 'MALI';
  if (isFinanceStaff) {
    if (STAFF_OPERATIONAL_COLLECTIONS.has(collection)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'دسترسی به این کالکشن برای نقش امور مالی مجاز نیست.' };
  }

  // Education Managers / Officers
  if (
    user.role === 'education_manager' ||
    user.role === 'education_officer' ||
    uUpper === 'SHAH' ||
    uUpper === 'SHAHPOORI'
  ) {
    if (STAFF_OPERATIONAL_COLLECTIONS.has(collection)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'دسترسی به این بخش برای نقش آموزش تعریف نشده است.' };
  }

  // Grade Mentor
  if ((user.role === 'grade_mentor' || user.role === 'mentor') && (user.gradeLabel || user.grade || user.mentorId)) {
    if (STAFF_OPERATIONAL_COLLECTIONS.has(collection)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'دسترسی به این بخش برای مسئول پایه مجاز نیست.' };
  }

  // Research Manager
  if (user.role === 'research_manager') {
    if (STAFF_OPERATIONAL_COLLECTIONS.has(collection)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'دسترسی به این بخش برای مسئول پژوهش مجاز نیست.' };
  }

  // Cultural Officer
  if (user.role === 'cultural_officer') {
    if (STAFF_OPERATIONAL_COLLECTIONS.has(collection)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'دسترسی به این بخش برای مسئول فرهنگی و رفاهی مجاز نیست.' };
  }

  // General Level 2 Staff (custom level 2 with explicit edit/view bounds)
  if (Number(user.level) === 2) {
    if (STAFF_OPERATIONAL_COLLECTIONS.has(collection)) {
      if ((action === 'write' || action === 'delete') && (user.isReadOnly === true || user.canEdit === false)) {
        return { allowed: false, reason: 'حساب کاربری شما دارای دسترسی فقط‌مشاهده است.' };
      }
      return { allowed: true };
    }
    return { allowed: false, reason: 'دسترسی به این بخش برای این حساب کاربری مجاز نیست.' };
  }

  // Teacher
  if (user.role === 'teacher') {
    if (action === 'read') {
      if (SHARED_SCHOOL_READ_COLLECTIONS.has(collection) || collection === 'teacher_transport_routines' || collection === 'teacher_transport_trips') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'استاد گرامی مجاز به مشاهده این بخش نیست.' };
    }
    if (action === 'write') {
      const teacherWritable = new Set([
        'attendance', 'counseling_session_grades', 'counseling_grades',
        'personal_todos', 'user_todo_categories', 'assigned_todos',
        'announcement_dismissals', 'db_save_errors'
      ]);
      if (teacherWritable.has(collection)) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'ثبت یا ویرایش این بخش برای نقش استاد مجاز نیست.' };
    }
    if (action === 'delete') {
      const teacherDeletable = new Set([
        'counseling_session_grades', 'counseling_grades', 'personal_todos', 'user_todo_categories'
      ]);
      if (teacherDeletable.has(collection)) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'حذف این بخش برای نقش استاد مجاز نیست.' };
    }
  }

  // Class Representative (Level 3 Representative)
  if (isClassRepresentativeUser(user)) {
    if (action === 'read') {
      if (SHARED_SCHOOL_READ_COLLECTIONS.has(collection)) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'نماینده کلاس مجاز به مشاهده این بخش نیست.' };
    }
    if (action === 'write') {
      if (STUDENT_WRITABLE_COLLECTIONS.has(collection) || collection === 'attendance' || collection === 'representative_notes' || collection === 'students') {
        if (collection !== 'attendance' && collection !== 'representative_notes' && collection !== 'students' && recordOwnerId) {
          const candidates = getUserIdentityCandidates(user);
          if (!candidates.includes(String(recordOwnerId).trim().toLowerCase())) {
            return { allowed: false, reason: 'شما فقط مجاز به ثبت اطلاعات شخصی خود هستید.' };
          }
        }
        return { allowed: true };
      }
      return { allowed: false, reason: 'ثبت یا تغییر این بخش برای نماینده کلاس مجاز نیست.' };
    }
    if (action === 'delete') {
      if (STUDENT_DELETABLE_COLLECTIONS.has(collection) || collection === 'attendance' || collection === 'representative_notes') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'حذف در این بخش برای نماینده کلاس مجاز نیست.' };
    }
  }

  // Regular Student (Level 3)
  if (isStudentLevelUser(user)) {
    if (action === 'read') {
      if (SHARED_SCHOOL_READ_COLLECTIONS.has(collection)) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'طلبه گرامی مجاز به مشاهده این اطلاعات نیست.' };
    }
    if (action === 'write') {
      if (STUDENT_WRITABLE_COLLECTIONS.has(collection)) {
        if (recordOwnerId && collection !== 'attendance' && collection !== 'db_save_errors') {
          const candidates = getUserIdentityCandidates(user);
          if (!candidates.includes(String(recordOwnerId).trim().toLowerCase())) {
            return { allowed: false, reason: 'شما فقط مجاز به ثبت یا ویرایش اطلاعات متعلق به خود هستید.' };
          }
        }
        return { allowed: true };
      }
      return { allowed: false, reason: 'طلبه گرامی مجاز به ثبت یا تغییر اطلاعات در این بخش نیست.' };
    }
    if (action === 'delete') {
      if (STUDENT_DELETABLE_COLLECTIONS.has(collection)) {
        if (recordOwnerId) {
          const candidates = getUserIdentityCandidates(user);
          if (!candidates.includes(String(recordOwnerId).trim().toLowerCase())) {
            return { allowed: false, reason: 'شما فقط مجاز به حذف رکوردهای شخصی خود هستید.' };
          }
        }
        return { allowed: true };
      }
      return { allowed: false, reason: 'حذف این اطلاعات برای طلبه مجاز نیست.' };
    }
  }

  // Fail-Closed default: deny any unrecognized role or collection action
  return { allowed: false, reason: 'دسترسی به این بخش به صورت پیش‌فرض مسدود است (Fail-Closed).' };
}

function parseTimesFromData(data: any): { startTime: string | null; endTime: string | null } {
  if (!data) return { startTime: null, endTime: null };
  const rawStart = data.startTime || data.start_time || data.classStartTime;
  const rawEnd = data.endTime || data.end_time || data.classEndTime;
  if (rawStart || rawEnd) {
    return {
      startTime: rawStart ? String(rawStart).trim().slice(0, 50) : null,
      endTime: rawEnd ? String(rawEnd).trim().slice(0, 50) : null
    };
  }
  const timeStr = typeof data.time === 'string' ? data.time : (typeof data.schedule === 'string' ? data.schedule : (typeof data.hours === 'string' ? data.hours : (typeof data.classTime === 'string' ? data.classTime : null)));
  if (!timeStr) return { startTime: null, endTime: null };
  const parts = timeStr.split(/ الی | تا | - | - | to /i);
  if (parts.length >= 2) {
    return {
      startTime: parts[0].trim().slice(0, 50),
      endTime: parts[1].trim().slice(0, 50)
    };
  }
  return {
    startTime: timeStr.trim().slice(0, 50),
    endTime: null
  };
}

// Convert JSON object into column-friendly fields for dedicated tables
export function prepareRecordForDedicatedTable(collection: string, data: any): { row: any; dedicatedTable: string | null } {
  const dedicatedTable = COLLECTION_TABLE_MAP[collection] || null;
  if (!dedicatedTable || !data) return { row: data, dedicatedTable: null };

  const id = data.id || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date().toISOString();

  let row: any = {
    id,
    data,
    updated_at: now
  };

  switch (dedicatedTable) {
    case 'students': {
      const cleanStr = (v: any) => (v === undefined || v === null || String(v).trim() === '') ? null : String(v).trim();
      row.national_id = cleanStr(data.nationalId || data.national_id);
      row.student_code = cleanStr(data.studentCode || data.student_code);
      row.name = data.name || 'نامشخص';
      row.grade = data.grade || data.gradeLabel || 'نامشخص';
      row.phone = cleanStr(data.phone || data.phoneNumber);
      row.father_name = cleanStr(data.fatherName || data.father_name);
      row.status = data.status || 'active';
      row.is_active = data.isActive !== undefined ? Boolean(data.isActive) : true;
      row.entry_year = cleanStr(data.entryYear || data.entry_year);
      row.mentor_id = cleanStr(data.mentorId || data.mentor_id);
      row.notes = cleanStr(data.notes);
      row.data = {
        ...data,
        grade: data.grade || data.gradeLabel || '',
        updatedAt: now
      };
      break;
    }

    case 'teachers':
      row.name = data.name || data.fullName || 'نامشخص';
      row.phone = data.phone || data.phoneNumber || null;
      row.specialty = data.specialty || null;
      row.email = data.email || null;
      row.is_active = data.isActive !== undefined ? Boolean(data.isActive) : true;
      row.data = data;
      break;

    case 'classrooms':
      row.title = data.title || 'کلاس بدون عنوان';
      row.grade = data.grade || null;
      row.capacity = Number(data.capacity) || 20;
      row.location = data.location || null;
      row.data = data;
      break;

    case 'programs': {
      const cleanStr = (v: any) => (v === undefined || v === null || String(v).trim() === '') ? null : String(v).trim();
      const parentId = cleanStr(data.parentProgramId || data.parent_program_id || data.linkedMainLessonId);
      const { startTime, endTime } = parseTimesFromData(data);
      row.title = data.title || 'برنامه بدون عنوان';
      row.type = data.type || 'اصلی';
      row.parent_program_id = parentId;
      row.grade = data.grade || 'نامشخص';
      row.teacher_id = cleanStr(data.teacherId || data.teacher_id);
      row.teacher_name = cleanStr(data.teacherName || data.teacher_name || data.teacher || data.instructor);
      row.classroom_id = cleanStr(data.classroomId || data.classroom_id || data.classroom || data.madrasRoom);
      row.day_of_week = Array.isArray(data.days) ? data.days.join(' ، ') : cleanStr(data.day);
      row.start_time = startTime;
      row.end_time = endTime;
      row.representative_student_ids = JSON.stringify(data.representativeStudentIds || []);
      row.representative_names = JSON.stringify(data.representativeNames || []);
      row.term = cleanStr(data.term);
      row.data = {
        ...data,
        parentProgramId: parentId || '',
        representativeStudentIds: data.representativeStudentIds || [],
        representativeNames: data.representativeNames || [],
        updatedAt: now
      };
      break;
    }

    case 'attendance': {
      const cleanStr = (v: any) => (v === undefined || v === null || String(v).trim() === '') ? null : String(v).trim();
      row.student_id = cleanStr(data.studentId || data.student_id);
      row.date = data.date || now.split('T')[0];
      row.grade = data.grade || 'نامشخص';
      row.program_id = cleanStr(data.programId || data.program_id);
      row.present_count = Number(data.presentCount ?? data.present_count) || 0;
      row.absent_count = Number(data.absentCount ?? data.absent_count) || 0;
      row.data = data;
      break;
    }

    case 'enrollments':
      row.student_id = data.studentId || data.student_id || 'unknown';
      row.program_id = data.programId || data.program_id || 'unknown';
      row.grade = data.grade || null;
      row.status = data.status || 'enrolled';
      row.data = data;
      break;

    case 'student_requests':
      row.student_id = data.studentId || data.student_id || 'unknown';
      row.unit = data.unit || data.category || 'آموزش';
      row.type = data.type || data.requestType || 'عمومی';
      row.status = data.status || 'pending';
      row.data = data;
      break;

    case 'received_articles':
      row.student_id = data.studentId || data.student_id || 'unknown';
      row.student_name = data.studentName || data.student_name || null;
      row.grade = data.grade || null;
      row.title = data.title || 'مقاله بدون عنوان';
      row.field = data.field || null;
      row.word_count = Number(data.wordCount) || 0;
      row.status = data.status || 'submitted';
      row.data = data;
      break;

    case 'article_evaluations':
      row.article_id = data.articleId || data.article_id || id;
      row.title = data.title || 'جلسه ارزیابی';
      row.student_id = data.studentId || data.student_id || 'unknown';
      row.student_name = data.studentName || data.student_name || null;
      row.grade = data.grade || null;
      row.session_date = data.sessionDate || data.session_date || null;
      row.status = data.status || 'scheduled';
      row.data = data;
      break;

    case 'evaluation_requests':
      row.evaluation_id = data.evaluationId || data.evaluation_id || 'none';
      row.article_id = data.articleId || data.article_id || null;
      row.student_id = data.studentId || data.student_id || 'unknown';
      row.student_name = data.studentName || data.student_name || null;
      row.grade = data.grade || null;
      row.request_type = data.requestType || data.request_type || 'article_evaluation';
      row.status = data.status || 'pending';
      row.data = data;
      break;

    case 'personal_todos':
      row.user_id = data.userId || data.user_id || 'unknown';
      row.user_name = data.userName || data.user_name || null;
      row.title = data.title || 'کار جدید';
      row.description = data.description || null;
      row.category = data.category || 'عمومی';
      row.completed = Boolean(data.completed);
      row.archived = Boolean(data.archived);
      row.priority = data.priority || 'medium';
      row.due_date = data.dueDate || data.due_date || null;
      break;

    case 'assigned_todos':
      row.sender_user_id = data.senderUserId || data.sender_user_id || 'unknown';
      row.sender_name = data.senderName || data.sender_name || null;
      row.recipient_user_id = data.recipientUserId || data.recipient_user_id || 'unknown';
      row.recipient_name = data.recipientName || data.recipient_name || null;
      row.title = data.title || 'ارجاع جدید';
      row.status = data.status || 'pending';
      break;

    case 'student_lockers':
      row.locker_number = Number(data.lockerNumber || data.locker_number) || 0;
      row.status = data.status || 'empty';
      row.student_id = data.studentId || data.student_id || null;
      row.student_name = data.studentName || data.student_name || null;
      row.student_grade = data.studentGrade || data.student_grade || null;
      row.assigned_at = data.assignedAt || data.assigned_at || null;
      row.inactive_reason = data.inactiveReason || data.inactive_reason || null;
      row.notes = data.notes || null;
      row.history = Array.isArray(data.history) ? data.history : [];
      break;

    default:
      break;
  }

  return { row, dedicatedTable };
}

async function syncStudentToUserAccount(studentRecord: any) {
  if (!studentRecord) return;
  try {
    const studentId = String(studentRecord.id || '');
    const natId = (studentRecord.nationalId || studentRecord.national_id || '').trim().toUpperCase();
    const studentGrade = studentRecord.grade ? String(studentRecord.grade).trim() : '';
    const studentName = studentRecord.name ? String(studentRecord.name).trim() : '';

    const users = await fetchAllUsersFromStorage();
    const matchingUser = users.find(u => 
      (u.linkedStudentId && String(u.linkedStudentId) === studentId) ||
      (u.studentId && String(u.studentId) === studentId) ||
      (natId && u.username.toUpperCase() === natId) ||
      (studentName && (u.name?.trim() === studentName || u.fullName?.trim() === studentName))
    );

    if (matchingUser) {
      const oldUsername = matchingUser.username.toUpperCase();
      const newUsername = natId || oldUsername;

      const updatedUser: StoredUser = {
        ...matchingUser,
        username: newUsername,
        nationalCode: natId || matchingUser.nationalCode || newUsername,
        nationalId: natId || matchingUser.nationalId || newUsername,
        gradeLabel: studentGrade || matchingUser.gradeLabel || matchingUser.grade,
        grade: studentGrade || matchingUser.grade || matchingUser.gradeLabel,
        name: studentName || matchingUser.name,
        fullName: studentName || matchingUser.fullName,
        isActive: studentRecord.isActive !== undefined ? Boolean(studentRecord.isActive) : matchingUser.isActive
      };

      if (newUsername !== oldUsername) {
        await deleteUserFromStorage(oldUsername);
      }
      await saveUserToStorage(updatedUser);
      notifyRealtimeChange('system_users', updatedUser.id, 'upsert');
    }
  } catch (e) {
    console.warn('Non-fatal syncStudentToUserAccount notice:', e);
  }
}

// Helper: Automatically synchronize announcements when Study Periods or Meal Reservation Periods open/close/delete
const MEAL_PERIOD_COLLECTIONS = new Set([
  'finance_meal_periods',
  'meal_periods',
  'lunch_periods',
  'meal_reservation_periods'
]);

async function syncPeriodAutoAnnouncementOnServer(
  collection: string,
  periodDoc: any | null,
  previousPeriodDoc: any | null,
  callerUser?: any
): Promise<void> {
  const isStudy = collection === 'study_periods';
  const isMeal = MEAL_PERIOD_COLLECTIONS.has(collection);
  if (!isStudy && !isMeal) return;

  const periodId = String(periodDoc?.id || previousPeriodDoc?.id || '').trim();
  if (!periodId) return;

  const kind: 'study_period' | 'meal_period' = isStudy ? 'study_period' : 'meal_period';
  const annId = isStudy ? getStudyPeriodAnnouncementId(periodId) : getMealPeriodAnnouncementId(periodId);

  try {
    let existingAnnouncement: any = null;
    try {
      existingAnnouncement = await MysqlRepository.getDocument('announcements', annId);
    } catch (readErr: any) {
      console.warn(`[STORAGE_FAILURE][autoAnnouncement.read] ID "${annId}":`, readErr?.message || readErr);
    }

    const decision = computePeriodAutoAnnouncementUpdate({
      kind,
      period: periodDoc,
      previousPeriod: previousPeriodDoc,
      existingAnnouncement,
      actorUser: callerUser
    });

    if (decision.action === 'upsert' && decision.announcement) {
      await MysqlRepository.saveDocument('announcements', decision.id, decision.announcement);
      invalidateCollectionCache('announcements');
      notifyRealtimeChange('announcements', decision.id, 'upsert');
      console.log(`[STORAGE_SUCCESS][autoAnnouncement.upsert] Period "${collection}/${periodId}" -> Announcement "${decision.id}" (active=${decision.announcement.isActive}, v${decision.announcement.version})`);
    } else if (decision.action === 'delete') {
      await MysqlRepository.deleteDocument('announcements', decision.id);
      invalidateCollectionCache('announcements');
      notifyRealtimeChange('announcements', decision.id, 'delete');
      console.log(`[STORAGE_SUCCESS][autoAnnouncement.delete] Period "${collection}/${periodId}" -> Deleted "${decision.id}"`);
    }
  } catch (err: any) {
    console.error(`[STORAGE_FAILURE][autoAnnouncement.sync] Collection "${collection}", ID "${periodId}":`, err?.message || err);
  }
}

// Server CRUD Handler: Save Document (Dedicated Table + App Collections Mirror)
export async function serverSaveDoc(
  collection: string,
  idOrData: any,
  dataOrCallerUser?: any
): Promise<{ success: boolean; id: string; item?: any; error?: string; affectedRows?: number; changedRows?: number; notFound?: boolean }> {
  if (!idOrData) return { success: false, id: '', error: 'داده‌های ارسالی نامعتبر است.' };

  let record: any;
  let callerUser: any = null;

  if (typeof idOrData === 'string') {
    // Format: serverSaveDoc(collection, id, record)
    const recordId = idOrData;
    if (dataOrCallerUser && typeof dataOrCallerUser === 'object') {
      record = { ...dataOrCallerUser, id: recordId };
    } else {
      record = { id: recordId };
    }
  } else {
    // Format: serverSaveDoc(collection, data, callerUser)
    record = { ...idOrData };
    callerUser = dataOrCallerUser;
  }

  const id = String(record.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
  record.id = id;

  if (collection === 'students') {
    syncStudentToUserAccount(record);
  }

  // Always mirror user records to user storage (system_users.json + memory) regardless of DB mode
  if (collection === 'all_users' || collection === 'system_users' || collection === 'users') {
    if (record && (record.username || record.id)) {
      saveUserToStorage(record).catch(err => {
        console.warn('[saveUserToStorage mirror warning]:', err);
      });
    }
  }

  // Invalidate L1 collection cache so subsequent GETs return fresh data
  invalidateCollectionCache(collection);

  // 1. If MySQL is configured: MySQL is the SINGLE source of truth (no disk/memory fallback)
  if (isMysqlConfigured) {
    try {
      let existingDocForAudit: any = null;
      if (collection !== 'audit_logs') {
        try {
          existingDocForAudit = await MysqlRepository.getDocument(collection, id);
        } catch {}
      }

      let finalRecord = existingDocForAudit && typeof existingDocForAudit === 'object'
        ? { ...existingDocForAudit, ...record }
        : { ...record };

      // Intelligent Merge for Attendance: Never overwrite concurrent student self-reporting sessions
      if (collection === 'attendance') {
        try {
          const nowIso = new Date().toISOString();
          const allAtt = await fetchRawCollectionData('attendance');
          const programId = String(record.programId || record.program_id || '');
          const dateStr = String(record.date || '');
          if (programId && dateStr) {
            const updatedStudents = Array.isArray(record.students)
              ? record.students.map((st: any) => ({
                  ...st,
                  _logUpdatedAt: nowIso,
                  updatedAt: st.updatedAt || nowIso
                }))
              : [];
            const recordWithTs = {
              ...record,
              students: updatedStudents,
              updatedAt: nowIso
            };

            const otherAtt = allAtt.filter((a: any) => a.id !== id && a.id !== record.id);
            const consolidated = getConsolidatedSessionLog([recordWithTs, ...otherAtt], programId, dateStr, record.programTitle);
            if (consolidated) {
              finalRecord = {
                ...consolidated,
                id: record.id || consolidated.id,
                updatedAt: nowIso
              };
            } else {
              finalRecord = recordWithTs;
            }

            // Prune any older duplicate records with different IDs for this exact session
            const normDate = normalizeShamsiDateStr(dateStr);
            const targetCleanDigits = toEnglishDigits(normDate).replace(/[\/\-]/g, '');
            for (const oldDoc of otherAtt) {
              if (oldDoc && oldDoc.id && oldDoc.id !== finalRecord.id) {
                const oldDate = normalizeShamsiDateStr(oldDoc.date);
                const oldClean = toEnglishDigits(oldDate).replace(/[\/\-]/g, '');
                const oldProgId = String(oldDoc.programId || oldDoc.program_id || '');
                if (oldClean === targetCleanDigits && (oldProgId === programId || (record.programTitle && oldDoc.programTitle === record.programTitle))) {
                  try {
                    await MysqlRepository.deleteDocument('attendance', oldDoc.id);
                  } catch (delErr) {}
                }
              }
            }
          }
        } catch (attMrgErr) {}
      }

      // Intelligent Merge for Students: Preserve name and nationalId from being replaced by نامشخص on partial patches
      if (collection === 'students') {
        try {
          const existingDoc = existingDocForAudit || await MysqlRepository.getDocument(collection, id);
          if (existingDoc) {
            finalRecord = {
              ...existingDoc,
              ...record
            };
            if ((!finalRecord.name || finalRecord.name === 'نامشخص') && existingDoc.name && existingDoc.name !== 'نامشخص') {
              finalRecord.name = existingDoc.name;
            }
            if (!finalRecord.nationalId && existingDoc.nationalId) {
              finalRecord.nationalId = existingDoc.nationalId;
            }
          }
        } catch (stMrgErr) {}
      }

      const authoritativeNowIso = new Date().toISOString();
      finalRecord = {
        ...finalRecord,
        id,
        updatedAt: authoritativeNowIso
      };

      const { row, dedicatedTable } = prepareRecordForDedicatedTable(collection, finalRecord);

      // Primary JSON document persistence
      const saveRes = await MysqlRepository.saveDocument(collection, id, finalRecord);

      // Secondary dedicated table sync (non-fatal if column constraint/type mismatch occurs)
      if (dedicatedTable && collection !== 'audit_logs') {
        try {
          await MysqlRepository.saveToDedicatedTable(dedicatedTable, row);
        } catch (dErr: any) {
          console.warn(`[MySQL Dedicated Table Non-fatal Notice] ${dedicatedTable}:`, dErr?.message || dErr);
        }
      }

      if (collection === 'all_users' || collection === 'system_users' || collection === 'users') {
        try {
          await saveUserToStorage(finalRecord as StoredUser);
        } catch (uErr: any) {
          console.error('[STORAGE_FAILURE] MySQL saveUserToStorage error in serverSaveDoc:', uErr?.message || uErr);
        }
      }

      invalidateCollectionCache(collection);
      const affectedRows = saveRes?.affectedRows ?? 1;
      const changedRows = (saveRes as any)?.changedRows ?? affectedRows;

      console.log(`[MySQL Fast Save Success] Collection: "${collection}", ID: "${id}", AffectedRows: ${affectedRows}`);

      // Synchronize automatic announcements when study or meal periods are opened/closed/deleted
      await syncPeriodAutoAnnouncementOnServer(collection, finalRecord, existingDocForAudit, callerUser);

      if (collection !== 'audit_logs') {
        const isUpdate = Boolean(existingDocForAudit);
        const entityLabel =
          finalRecord.title ||
          finalRecord.name ||
          finalRecord.fullName ||
          finalRecord.studentName ||
          finalRecord.programTitle ||
          finalRecord.username ||
          id;
        const actorName = callerUser?.fullName || callerUser?.name || callerUser?.username || 'سیستم هوشمند';

        // 1. Legacy MySQL audit_logs table
        logAudit({
          action: isUpdate ? 'update' : 'insert',
          collectionName: collection,
          recordId: id,
          userId: callerUser?.id || callerUser?.userId,
          userName: callerUser?.username || callerUser?.name,
          userRole: callerUser?.role,
          details: finalRecord,
          status: 'success'
        }).catch(() => {});

        // 2. Rich AuditLog document in app_collections ('audit_logs') with previousState & newState for Revert
        logServerAudit({
          userId: callerUser?.id || callerUser?.userId || 'system',
          username: callerUser?.username || 'system',
          userName: actorName,
          userRole: callerUser?.role || 'system',
          userRoleTitle: callerUser?.roleTitle,
          userLevel: callerUser?.level,
          action: isUpdate ? 'DATA_UPDATE' : 'DATA_CREATE',
          actionType: isUpdate ? 'update' : 'create',
          entityType: collection,
          entityId: id,
          entityName: String(entityLabel),
          description: `${isUpdate ? 'ویرایش' : 'ایجاد'} «${entityLabel}» در بخش ${collection} توسط ${actorName}`,
          previousState: existingDocForAudit || null,
          newState: finalRecord
        }).catch(() => {});
      }

      notifyRealtimeChange(collection, id, 'upsert');
      return { success: true, id, item: finalRecord, affectedRows, changedRows } as any;
    } catch (mErr: any) {
      console.error(`[MySQL Save Fatal Error] Collection: "${collection}", ID: "${id}":`, mErr?.message || mErr);

      // Log Failed Audit Entry
      await logAudit({
        action: 'insert',
        collectionName: collection,
        recordId: id,
        userId: callerUser?.id || callerUser?.userId,
        userName: callerUser?.username || callerUser?.name,
        userRole: callerUser?.role,
        status: 'error',
        errorMessage: mErr?.message || 'مشکل پایگاه داده'
      }).catch(() => {});

      return {
        success: false,
        id: '',
        error: `خطا در ذخیره‌سازی در دیتابیس: ${mErr?.message || 'مشکل پایگاه داده'}`
      };
    }
  }

  // Fail-Fast: MySQL is the sole authoritative persistence store
  console.error(`[Data Layer Fatal] Database unavailable or MySQL unconfigured for collection: "${collection}", ID: "${id}"`);
  return {
    success: false,
    id: '',
    error: 'پایگاه داده MySQL در دسترس نیست. سرویس ذخیره‌سازی ابری موقتاً پاسخگو نیست (503 Service Unavailable).'
  };
}

// Server CRUD Handler: Delete Document
export async function serverDeleteDoc(collection: string, id: string, callerUser?: any): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'شناسه الزامی است.' };

  // 1. If MySQL is configured: MySQL is the SINGLE source of truth
  if (isMysqlConfigured) {
    try {
      let existingRecord: any = null;
      try {
        existingRecord = await MysqlRepository.getDocument(collection, id);
      } catch {}

      const delRes = await MysqlRepository.deleteDocument(collection, id);
      const affectedRows = delRes?.affectedRows || 0;

      // If deleting a user or a student, also remove corresponding user account from all storage & caches
      if (collection === 'all_users' || collection === 'system_users' || collection === 'users') {
        evictUserFromMemoryStores(id);
        try {
          await deleteUserFromStorage(id);
        } catch (uDelErr: any) {
          console.error(`[STORAGE_FAILURE] serverDeleteDoc user storage cleanup failed for "${id}":`, uDelErr?.message || uDelErr);
        }
        if (existingRecord?.username) {
          evictUserFromMemoryStores(String(existingRecord.username));
          try {
            await deleteUserFromStorage(String(existingRecord.username));
          } catch (uDelErr2: any) {
            console.error(`[STORAGE_FAILURE] serverDeleteDoc username cleanup failed for "${existingRecord.username}":`, uDelErr2?.message || uDelErr2);
          }
        }
        invalidateCollectionCache('system_users');
      } else if (collection === 'students') {
        const studentCleanupKeys = [
          id,
          existingRecord?.nationalId ? String(existingRecord.nationalId) : '',
          existingRecord?.studentCode ? String(existingRecord.studentCode) : '',
          existingRecord?.userAccountUsername ? String(existingRecord.userAccountUsername) : ''
        ].filter(Boolean);
        for (const key of studentCleanupKeys) {
          evictUserFromMemoryStores(key);
          try {
            await deleteUserFromStorage(key);
          } catch (stDelErr: any) {
            console.error(`[STORAGE_FAILURE] serverDeleteDoc linked student-user cleanup failed for "${key}":`, stDelErr?.message || stDelErr);
          }
        }
        invalidateCollectionCache('system_users');
        notifyRealtimeChange('system_users', id, 'delete');
      }

      // Invalidate L1 collection cache immediately
      invalidateCollectionCache(collection);

      // Clean up linked auto-announcement if a study or meal period is deleted
      await syncPeriodAutoAnnouncementOnServer(collection, null, existingRecord || { id }, callerUser);

      if (collection !== 'audit_logs') {
        const entityLabel =
          existingRecord?.title ||
          existingRecord?.name ||
          existingRecord?.fullName ||
          existingRecord?.studentName ||
          existingRecord?.programTitle ||
          existingRecord?.username ||
          id;
        const actorName = callerUser?.fullName || callerUser?.name || callerUser?.username || 'سیستم هوشمند';

        // Log Audit Entry asynchronously (non-blocking) with full deleted record for rollback capability
        logAudit({
          action: 'delete',
          collectionName: collection,
          recordId: id,
          userId: callerUser?.id || callerUser?.userId,
          userName: callerUser?.username || callerUser?.name,
          userRole: callerUser?.role,
          details: { deletedId: id, affectedRows, deletedRecord: existingRecord },
          status: 'success'
        }).catch(() => {});

        logServerAudit({
          userId: callerUser?.id || callerUser?.userId || 'system',
          username: callerUser?.username || 'system',
          userName: actorName,
          userRole: callerUser?.role || 'system',
          userRoleTitle: callerUser?.roleTitle,
          userLevel: callerUser?.level,
          action: 'DATA_DELETE',
          actionType: 'delete',
          entityType: collection,
          entityId: id,
          entityName: String(entityLabel),
          description: `حذف «${entityLabel}» از بخش ${collection} توسط ${actorName}`,
          previousState: existingRecord || { id },
          newState: null
        }).catch(() => {});
      }

      notifyRealtimeChange(collection, id, 'delete');
      return { success: true };
    } catch (mErr: any) {
      console.error(`[MySQL Delete Fatal Error] Collection: "${collection}", ID: "${id}"`);
      console.error(`[MySQL Error Details]:`, mErr?.message || mErr);
      if (mErr?.stack) console.error(`[MySQL Stack Trace]:`, mErr.stack);

      // Log Failed Audit Entry
      await logAudit({
        action: 'delete',
        collectionName: collection,
        recordId: id,
        userId: callerUser?.id || callerUser?.userId,
        userName: callerUser?.username || callerUser?.name,
        userRole: callerUser?.role,
        status: 'error',
        errorMessage: mErr?.message || 'خطا در حذف داده'
      });

      return {
        success: false,
        error: 'خطا در حذف داده. لطفاً با مدیر سیستم تماس بگیرید.'
      };
    }
  }

  // Fail-Fast: MySQL is the sole authoritative persistence store
  console.error(`[Data Layer Fatal] Database unavailable or MySQL unconfigured for delete collection: "${collection}", ID: "${id}"`);
  return {
    success: false,
    error: 'پایگاه داده MySQL در دسترس نیست. عملیات حذف امکان‌پذیر نمی‌باشد (503 Service Unavailable).'
  };
}

// Internal helper to retrieve raw collection data without filtering
async function fetchRawCollectionData(collection: string): Promise<any[]> {
  const now = Date.now();
  const cached = rawCollectionCache.get(collection);
  if (cached && (now - cached.timestamp < RAW_CACHE_TTL_MS)) {
    return cached.data;
  }

  let items: any[] = [];

  // Fetch exclusively from MySQL repository
  if (isMysqlConfigured) {
    try {
      const mysqlItems = await MysqlRepository.queryCollection(collection);
      items = mysqlItems || [];

      // Auto-purge any soft-deleted or inactive programs permanently from MySQL
      if (collection === 'programs' && items.length > 0) {
        const toPurge = items.filter((p: any) => p && (p.isDeleted === true || p.status === 'inactive' || p.status === 'deleted'));
        if (toPurge.length > 0) {
          for (const deadProg of toPurge) {
            if (deadProg.id) {
              try {
                await MysqlRepository.deleteDocument('programs', String(deadProg.id));
                notifyRealtimeChange('programs', String(deadProg.id), 'delete');
              } catch (purgeErr) {}
            }
          }
          items = items.filter((p: any) => !p || (p.isDeleted !== true && p.status !== 'inactive' && p.status !== 'deleted'));
        }
      }
    } catch (mErr: any) {
      console.error(`[MySQL Raw Query Error for ${collection}]:`, mErr?.message || mErr);
      if (mErr?.stack) console.error(`[MySQL Stack Trace]:`, mErr.stack);
      items = [];
    }
  } else {
    console.error(`[MySQL Unconfigured Error]: Cannot fetch collection "${collection}" because MySQL is not configured.`);
    items = [];
  }

  rawCollectionCache.set(collection, { data: items, timestamp: now });
  return items;
}

// Get Single Document from Candidate IDs with Strict Role-Based Filtering
export function canUserReadDoc(user: any, collection: string, doc: any, context?: any): boolean {
  if (!user) {
    return PUBLIC_READ_COLLECTIONS.has(collection);
  }

  // Super Admins & School Managers have full access across all collections
  if (user.level === 1 || user.role === 'super_admin' || user.role === 'school_manager') {
    return true;
  }

  // 1. Students collection
  if (collection === 'students') {
    if (user.role === 'education_manager' || user.role === 'education_officer') {
      return true;
    }

    if (user.role === 'grade_mentor') {
      const mentorGrade = user.gradeLabel || user.grade;
      return mentorGrade ? String(doc.grade || '').trim() === String(mentorGrade).trim() : false;
    }

    if (user.role === 'teacher') {
      if (context?.enrolledStudentIds && context?.teacherGrades) {
        const sId = String(doc.id || '');
        const sGrade = String(doc.grade || '').trim();
        return context.enrolledStudentIds.has(sId) || (context.teacherGrades.size > 0 && context.teacherGrades.has(sGrade));
      }
      return false; // Fail-closed if teacher context is missing
    }

    // Class Representative: Can view themselves AND all students enrolled in classes they represent
    if (context?.isRepresentative || user.role === 'class_representative' || user.roleTitle?.includes('نماینده') || Boolean(user.managedClassId)) {
      const uUsername = String(user.username || '').trim().toUpperCase();
      const uStudentId = String(user.studentId || user.id || '').trim();
      const sId = String(doc.id || '').trim();
      const sCode = String(doc.studentCode || '').trim().toUpperCase();
      const sNat = String(doc.nationalId || doc.nationalCode || '').trim();

      // 1. Is this the representative themselves?
      if ((uStudentId && sId === uStudentId) || (uUsername && (sCode === uUsername || sNat === uUsername))) {
        return true;
      }

      // 2. Is this student enrolled in one of the representative's classes?
      if (context?.repEnrolledStudentIds) {
        if (
          context.repEnrolledStudentIds.has(sId) ||
          (sCode && context.repEnrolledStudentIds.has(sCode)) ||
          (sNat && context.repEnrolledStudentIds.has(sNat))
        ) {
          return true;
        }

        // Case-insensitive / trimmed fallback match
        const sIdLower = sId.toLowerCase();
        for (const repSid of context.repEnrolledStudentIds) {
          const rClean = String(repSid).trim().toLowerCase();
          if (rClean && (rClean === sIdLower || (sCode && rClean === sCode.toLowerCase()) || (sNat && rClean === sNat.toLowerCase()))) {
            return true;
          }
        }
      }

      // 3. If representative is assigned a specific grade
      const repGrade = user.gradeLabel || user.grade;
      if (repGrade && String(doc.grade || '').trim() === String(repGrade).trim()) {
        return true;
      }

      return false;
    }

    if (user.role === 'student' || user.level === 3) {
      const uUsername = String(user.username || '').trim().toUpperCase();
      const uStudentId = String(user.studentId || user.id || '').trim();
      const sId = String(doc.id || '').trim();
      const sCode = String(doc.studentCode || '').trim().toUpperCase();
      const sNat = String(doc.nationalId || doc.nationalCode || '').trim();
      return (uStudentId && sId === uStudentId) || (uUsername && (sCode === uUsername || sNat === uUsername));
    }

    return false;
  }

  // 2. periodic_study_logs & study_daily_entries
  if (collection === 'periodic_study_logs' || collection === 'study_daily_entries') {
    if (user.role === 'student' || user.level === 3) {
      const uUsername = String(user.username || '').toLowerCase().trim();
      const uStudentId = String(user.studentId || user.linkedStudentId || user.id || '').toLowerCase().trim();
      const uName = String(user.name || user.fullName || '').toLowerCase().trim();

      const docStudentId = String(doc.studentId || doc.student_id || doc.userId || doc.user_id || '').toLowerCase().trim();
      const docNat = String(doc.nationalId || doc.nationalCode || doc.national_id || '').toLowerCase().trim();
      const docName = String(doc.studentName || doc.student_name || '').toLowerCase().trim();

      if (!docStudentId && !docNat && !docName) {
        // Safe fallback if doc metadata was not attached
        return true;
      }

      return (
        (uStudentId && docStudentId && (uStudentId === docStudentId || docStudentId.includes(uStudentId) || uStudentId.includes(docStudentId))) ||
        (uUsername && (docNat === uUsername || docStudentId === uUsername)) ||
        (uName && docName && (uName.includes(docName) || docName.includes(uName)))
      );
    }
    // Teachers, mentors, class representatives, and other managers can view study logs
    return true;
  }

  // 3. FINANCIAL collections (Tuition Records, etc.)
  if (FINANCIAL_COLLECTIONS.has(collection)) {
    const isFinanceStaff = user.role === 'finance_manager' || user.role === 'financial_officer' || user.username?.toUpperCase() === 'MALI';
    if (isFinanceStaff) {
      return true;
    }
    if (collection === 'tuition_records' && (user.role === 'student' || user.level === 3)) {
      const uUsername = String(user.username || '').trim().toUpperCase();
      const uStudentId = String(user.studentId || user.id || '').trim();
      const rStudentId = String(doc.studentId || doc.student_id || '').trim();
      const rStudentCode = String(doc.studentCode || doc.student_code || '').trim().toUpperCase();
      return (uStudentId && rStudentId === uStudentId) || (uUsername && rStudentCode === uUsername);
    }
    return false;
  }

  // 4. System Users collection
  if (collection === 'system_users' || collection === 'all_users' || collection === 'users') {
    const uName = String(user.username || '').toUpperCase();
    return user.level === 1 || user.role === 'education_manager' || user.role === 'education_officer' || uName === 'SHAH' || uName === 'SADEGH';
  }

  // 5. Personal Todos & Todo Categories
  if (collection === 'personal_todos' || collection === 'user_todo_categories') {
    return doc.userId === user.id || doc.user_id === user.id;
  }

  // 5b. Assigned Todos & Todos
  if (collection === 'assigned_todos' || collection === 'todos') {
    if (!isRegularStudentUser(user)) return true;
    const candidates = getUserIdentityCandidates(user);
    const todoOwners = [doc.recipientUserId, doc.senderUserId, doc.userId, doc.studentId]
      .filter(Boolean)
      .map((x: any) => String(x).trim().toLowerCase());
    return todoOwners.some(id => candidates.includes(id));
  }

  // 6. Counseling Session Grades
  if (collection === 'counseling_session_grades' || collection === 'counseling_grades') {
    if (user.role === 'teacher' || user.level === 1 || user.role === 'super_admin' || user.role === 'education_manager' || user.role === 'education_officer' || user.role === 'research_manager' || user.role === 'grade_mentor') {
      return true;
    }
    if (isStudentLevelUser(user)) {
      const studentCandidates = getUserIdentityCandidates(user);
      const docCandidates = [doc.studentId, doc.student_id, doc.studentCode, doc.nationalId, doc.userId].filter(Boolean).map(x => String(x).toLowerCase().trim());
      if (studentCandidates.length === 0 || docCandidates.length === 0) return false;
      return studentCandidates.some(sc => docCandidates.includes(sc));
    }
    return Number(user.level) <= 2;
  }

  // 7. Student Requests (Students see their own requests; Officers & Admins see all/unit requests)
  if (collection === 'student_requests') {
    if (user.level === 1 || user.role === 'super_admin' || user.role === 'school_manager' ||
        user.role === 'education_manager' || user.role === 'education_officer' ||
        user.role === 'finance_manager' || user.role === 'financial_officer' ||
        user.role === 'cultural_officer' || user.role === 'grade_mentor' ||
        Number(user.level) <= 2) {
      return true;
    }
    if (isStudentLevelUser(user)) {
      const candidates = getUserIdentityCandidates(user);
      const uName = String(user.name || user.fullName || '').trim();
      const docStudentId = String(doc.studentId || doc.student_id || '').trim().toLowerCase();
      const docNat = String(doc.nationalCode || doc.national_id || '').trim().toLowerCase();
      const docName = String(doc.studentName || doc.student_name || '').trim();
      return (docStudentId && candidates.includes(docStudentId)) ||
             (docNat && candidates.includes(docNat)) ||
             (uName && docName === uName);
    }
    return false;
  }

  // 8. Announcement Dismissals: users only see their own dismissal records unless admin/education officer
  if (collection === 'announcement_dismissals') {
    const uName = String(user.username || '').toUpperCase();
    const isAdminOrEdu =
      user.level === 1 ||
      user.role === 'super_admin' ||
      user.role === 'education_manager' ||
      user.role === 'education_officer' ||
      uName === 'SADEGH' ||
      uName === 'SHAH';
    if (isAdminOrEdu) return true;
    const candidates = getUserIdentityCandidates(user);
    const docUser = String(doc.userId || '').trim().toLowerCase();
    const docStudent = String(doc.studentId || '').trim().toLowerCase();
    const docUname = String(doc.username || '').trim().toLowerCase();
    return Boolean(
      (docUser && candidates.includes(docUser)) ||
      (docStudent && candidates.includes(docStudent)) ||
      (docUname && candidates.includes(docUname))
    );
  }

  // 9. Attendance: Regular students can only read sessions containing their own record (and classmates' entries are stripped in query)
  if (collection === 'attendance') {
    if (
      Number(user.level) <= 2 ||
      user.role === 'teacher' ||
      isClassRepresentativeUser(user) ||
      context?.isRepresentative
    ) {
      return true;
    }
    if (isRegularStudentUser(user)) {
      const candidates = context?.studentCandidates || getUserIdentityCandidates(user);
      if (doc.studentId && candidates.includes(String(doc.studentId).trim().toLowerCase())) {
        return true;
      }
      if (Array.isArray(doc.students)) {
        return doc.students.some((st: any) => isMatchingStudentEntry(st, candidates, user));
      }
      return false;
    }
    return false;
  }

  // 10. Student-owned personal collections
  const STUDENT_SCOPED_COLLECTIONS = new Set([
    'course_selection_requests',
    'student_meal_reservations', 'finance_student_meal_reservations',
    'meal_reservations', 'lunch_reservations',
    'custom_student_schedules',
    'received_articles', 'evaluation_requests',
    'student_course_progress', 'passed_courses',
    'oral_exams', 'oral_exam_records',
    'research', 'research_records', 'research_history', 'student_research_skills',
    'student_comments', 'comments'
  ]);
  if (STUDENT_SCOPED_COLLECTIONS.has(collection)) {
    if (Number(user.level) <= 2 || user.role === 'teacher') {
      return true;
    }
    if (isStudentLevelUser(user)) {
      const candidates = context?.studentCandidates || getUserIdentityCandidates(user);
      const docOwnerIds = [
        doc.studentId, doc.student_id, doc.userId, doc.user_id,
        doc.nationalId, doc.nationalCode, doc.studentCode
      ]
        .filter(Boolean)
        .map((x: any) => String(x).trim().toLowerCase());
      if (docOwnerIds.some(oid => candidates.includes(oid))) return true;
      const uName = String(user.name || user.fullName || '').trim().toLowerCase();
      const dName = String(doc.studentName || doc.student_name || '').trim().toLowerCase();
      return Boolean(docOwnerIds.length === 0 && uName && dName && uName === dName);
    }
    return false;
  }

  // 11. Student Lockers
  if (collection === 'student_lockers' || collection === 'lockers' || collection === 'locker_history') {
    if (Number(user.level) <= 2) return true;
    if (isStudentLevelUser(user)) {
      const candidates = context?.studentCandidates || getUserIdentityCandidates(user);
      const sid = String(doc.studentId || doc.student_id || '').trim().toLowerCase();
      return Boolean(sid && candidates.includes(sid));
    }
    return false;
  }

  // 12. Workflow items
  if (collection === 'workflow_items' || collection === 'workflow') {
    if (Number(user.level) <= 2) return true;
    if (isStudentLevelUser(user)) {
      const candidates = context?.studentCandidates || getUserIdentityCandidates(user);
      const wfIds = [
        doc.studentId, doc.userId, doc.requestedByUserId,
        doc.details?.requestedByStudentId, doc.details?.studentId
      ]
        .filter(Boolean)
        .map((x: any) => String(x).trim().toLowerCase());
      return wfIds.some(id => candidates.includes(id));
    }
    return false;
  }

  // 13. Shared non-PII school metadata & calendars
  if (SHARED_METADATA_READ_COLLECTIONS.has(collection)) {
    return true;
  }

  // 14. Operational / Finance / Admin staff collections (only Level 1/2 staff)
  if (STAFF_OPERATIONAL_COLLECTIONS.has(collection) || collection === 'audit_logs') {
    return Number(user.level) <= 2;
  }

  // Fail-Closed default
  return false;
}

function sanitizeAttendanceDocForUser(doc: any, user: any, candidates: string[]): any {
  if (!doc || !Array.isArray(doc.students)) return doc;
  if (!isRegularStudentUser(user)) return doc;
  const ownStudents = doc.students.filter((st: any) => isMatchingStudentEntry(st, candidates, user));
  return {
    ...doc,
    students: ownStudents
  };
}

// Internal helper to retrieve multiple raw documents by collection and candidate IDs
async function fetchRawDocumentsByIds(collection: string, ids: string[]): Promise<any[]> {
  if (!ids || ids.length === 0) return [];

  // Special case for system_users / users / all_users: check authoritative user storage
  if (collection === 'system_users' || collection === 'users' || collection === 'all_users') {
    try {
      const allUsers = await fetchAllUsersFromStorage();
      const cleanIds = ids.map(x => String(x).toUpperCase().trim());
      const matched = allUsers.filter(u => 
        cleanIds.includes(String(u.id || '').toUpperCase().trim()) || 
        cleanIds.includes(String(u.username || '').toUpperCase().trim())
      );
      if (matched && matched.length > 0) {
        return matched.map(u => ({ ...u, id: u.id || u.username }));
      }
    } catch (uErr) {
      console.warn('[fetchRawDocumentsByIds system_users notice]:', uErr);
    }
  }

  // 1. If MySQL is configured, fetch directly from MySQL with IN (...)
  if (isMysqlConfigured) {
    try {
      const mysqlDocs = await MysqlRepository.getDocumentsByIds(collection, ids);
      return mysqlDocs || [];
    } catch (mErr: any) {
      console.error(`[MySQL Get Docs Fatal Error for ${collection}]:`, mErr?.message || mErr);
      if (mErr?.stack) console.error(`[MySQL Stack Trace]:`, mErr.stack);
      return [];
    }
  }

  return [];
}

export async function getRawExistingDocById(collection: string, id: string): Promise<any | null> {
  if (!id) return null;
  const docs = await fetchRawDocumentsByIds(collection, [id]);
  return docs && docs.length > 0 ? docs[0] : null;
}

// Server CRUD Handler: Get Single Document from Candidate IDs with Strict Role-Based Filtering
export async function serverGetDocByCandidateIds(collection: string, candidateIds: string[], user?: any): Promise<any | null> {
  if (!candidateIds || candidateIds.length === 0) return null;

  // 1. Security Check: Unauthenticated callers cannot query non-public collections
  if (!user) {
    if (PUBLIC_READ_COLLECTIONS.has(collection)) {
      const rawDocs = await fetchRawDocumentsByIds(collection, candidateIds);
      return rawDocs[0] || null;
    }
    return null;
  }

  // 2. Authorization check
  const authCheck = authorizeCollectionAccess(user, collection, 'read');
  if (!authCheck.allowed) {
    return null;
  }

  // 3. Fetch matching candidate documents
  const docs = await fetchRawDocumentsByIds(collection, candidateIds);
  if (!docs || docs.length === 0) return null;

  // 4. Unified Security check: filter candidates using canUserReadDoc
  let context: any = {};
  if (isRegularStudentUser(user)) {
    const identity = await resolveAuthoritativeStudentIdentity(user);
    context.studentCandidates = identity.candidates;
  }
  const allowedDocs = docs
    .filter(doc => canUserReadDoc(user, collection, doc, context))
    .map(doc => collection === 'attendance' ? sanitizeAttendanceDocForUser(doc, user, context.studentCandidates || getUserIdentityCandidates(user)) : doc);
  if (allowedDocs.length === 0) return null;

  // Requirement 4: "۴. اگر هر دو کلید log_ و studylog_ وجود داشتند، log_ را برگردان."
  if (allowedDocs.length > 1) {
    const logDoc = allowedDocs.find(d => String(d.id).startsWith('log_'));
    if (logDoc) return logDoc;
  }

  return allowedDocs[0];
}

// Server CRUD Handler: Query Collection with Strict Role-Based Filtering
export async function serverQueryCollection(collection: string, user?: any): Promise<any[]> {
  // 1. Security Check: Unauthenticated callers cannot query non-public collections
  if (!user) {
    if (PUBLIC_READ_COLLECTIONS.has(collection)) {
      return fetchRawCollectionData(collection);
    }
    return [];
  }

  // 1b. Enforce collection-level read access
  const authCheck = authorizeCollectionAccess(user, collection, 'read');
  if (!authCheck.allowed) {
    return [];
  }

  // 2. Fetch raw items
  const rawItems = await fetchRawCollectionData(collection);
  if (!rawItems || rawItems.length === 0) return [];

  // 3. Super Admins & School Managers have full access across all collections
  if (user.level === 1 || user.role === 'super_admin' || user.role === 'school_manager') {
    return rawItems;
  }

  // 4. Precompute Context for Teacher / Class Representative / Students collection if needed to avoid N+1 queries
  let context: any = {};
  if (collection === 'students') {
    if (user.role === 'teacher') {
      const teacherId = user.teacherId || user.id || user.linkedTeacherId;
      const teacherName = (user.name || user.fullName || '').trim();
      const cleanTeacher = cleanTeacherName(teacherName);

      const programs = await fetchRawCollectionData('programs');
      const teacherPrograms = programs.filter((p: any) => {
        const pTeacherId = p.teacherId || p.teacher_id;
        const pTeacherName = p.teacher || p.teacherName || p.teacher_name || '';
        if (teacherId && pTeacherId && (pTeacherId === teacherId || pTeacherId === user.id)) return true;
        if (cleanTeacher && pTeacherName && cleanTeacherName(pTeacherName) === cleanTeacher) return true;
        return false;
      });

      const teacherProgramIds = new Set(teacherPrograms.map((p: any) => String(p.id)));
      const teacherGrades = new Set<string>();
      teacherPrograms.forEach((p: any) => {
        if (p.grade) teacherGrades.add(String(p.grade).trim());
      });

      const schedules = await fetchRawCollectionData('teacher_schedules');
      schedules.forEach((sch: any) => {
        const schTeacherId = sch.teacherId || sch.teacher_id;
        const schTeacherName = sch.teacher_name || sch.teacherName || '';
        if (
          (teacherId && schTeacherId === teacherId) ||
          (cleanTeacher && schTeacherName && cleanTeacherName(schTeacherName) === cleanTeacher)
        ) {
          if (sch.grade) teacherGrades.add(String(sch.grade).trim());
        }
      });

      const enrollments = await fetchRawCollectionData('enrollments');
      const enrolledStudentIds = new Set<string>();
      enrollments.forEach((enr: any) => {
        if (teacherProgramIds.has(String(enr.programId || enr.program_id))) {
          enrolledStudentIds.add(String(enr.studentId || enr.student_id));
        }
      });

      context = { enrolledStudentIds, teacherGrades };
    } else if (
      user.role === 'class_representative' || 
      user.roleTitle?.includes('نماینده') || 
      user.managedClassId || 
      user.level === 3 || 
      user.role === 'student'
    ) {
      // Find represented programs
      const programs = await fetchRawCollectionData('programs');
      const enrollments = await fetchRawCollectionData('enrollments');
      const studentsList = rawItems;

      const candidateIds = [
        user.studentId, 
        user.linkedStudentId, 
        user.id, 
        user.userId, 
        user.username
      ].filter(Boolean).map(x => String(x).toLowerCase().trim());

      const candidateNames = [
        user.name, 
        user.fullName, 
        user.studentName
      ].filter(Boolean).map(x => String(x).toLowerCase().trim());

      // Match student record from students list to gather accurate student ID, studentCode, nationalId
      const matchedStudent = studentsList.find((s: any) => {
        const sId = String(s.id || '').toLowerCase().trim();
        const sCode = String(s.studentCode || '').toLowerCase().trim();
        const sNat = String(s.nationalId || s.nationalCode || '').toLowerCase().trim();
        const sName = String(s.name || s.fullName || '').toLowerCase().trim();
        const uName = String(user.username || '').toLowerCase().trim();
        const uId = String(user.id || user.userId || '').toLowerCase().trim();
        const uSid = String(user.studentId || user.linkedStudentId || '').toLowerCase().trim();

        if (uSid && (sId === uSid || sCode === uSid || sNat === uSid)) return true;
        if (uId && sId === uId) return true;
        if (uName && (sCode === uName || sNat === uName || sId === uName)) return true;
        if (candidateNames.length > 0 && candidateNames.some(cn => cn && (sName === cn || sName.includes(cn) || cn.includes(sName)))) return true;
        return false;
      });

      if (matchedStudent) {
        if (matchedStudent.id) candidateIds.push(String(matchedStudent.id).toLowerCase().trim());
        if (matchedStudent.studentCode) candidateIds.push(String(matchedStudent.studentCode).toLowerCase().trim());
        if (matchedStudent.nationalId) candidateIds.push(String(matchedStudent.nationalId).toLowerCase().trim());
        if (matchedStudent.name) candidateNames.push(String(matchedStudent.name).toLowerCase().trim());
      }

      const managedClassId = user.managedClassId ? String(user.managedClassId).trim() : null;
      const repProgramIdsFromUser = Array.isArray(user.representativeProgramIds) 
        ? user.representativeProgramIds.map((x: any) => String(x).trim()) 
        : [];

      const repPrograms = programs.filter((p: any) => {
        const pId = String(p.id).trim();
        if (managedClassId && pId === managedClassId) return true;
        if (repProgramIdsFromUser.includes(pId)) return true;

        if (Array.isArray(p.representativeStudentIds) && p.representativeStudentIds.length > 0) {
          if (p.representativeStudentIds.some((id: any) => candidateIds.includes(String(id).toLowerCase().trim()))) {
            return true;
          }
        }
        if (Array.isArray(p.representativeNames) && p.representativeNames.length > 0) {
          if (p.representativeNames.some((n: string) => {
            const norm = String(n).toLowerCase().trim();
            return candidateNames.some(c => norm.includes(c) || c.includes(norm));
          })) {
            return true;
          }
        }
        if (p.customRepresentative) {
          const norm = String(p.customRepresentative).toLowerCase().trim();
          if (candidateNames.some(c => norm.includes(c) || c.includes(norm))) {
            return true;
          }
        }
        return false;
      });

      // If user is designated as class_representative but program hasn't stored rep ID yet, match through their enrolled classes (ONLY for legacy programs without explicit representative configuration)
      if (repPrograms.length === 0 && (user.role === 'class_representative' || user.roleTitle?.includes('نماینده') || managedClassId)) {
        const enrolledProgIds = new Set<string>();
        enrollments.forEach((enr: any) => {
          const sid = String(enr.studentId || enr.student_id || '').toLowerCase().trim();
          if (candidateIds.includes(sid)) {
            enrolledProgIds.add(String(enr.programId || enr.program_id || '').trim());
          }
        });
        programs.forEach((p: any) => {
          const pid = String(p.id).trim();
          const hasExplicitRepArray = Array.isArray(p.representativeStudentIds);
          if (!hasExplicitRepArray) {
            if (enrolledProgIds.has(pid) || (Array.isArray(p.studentIds) && p.studentIds.some((sid: any) => candidateIds.includes(String(sid).toLowerCase().trim())))) {
              repPrograms.push(p);
            }
          }
        });
      }

      if (repPrograms.length > 0) {
        const repProgIds = new Set(repPrograms.map((p: any) => String(p.id).trim()));
        if (managedClassId) repProgIds.add(managedClassId);

        const repEnrolledStudentIds = new Set<string>();
        enrollments.forEach((enr: any) => {
          const pId = String(enr.programId || enr.program_id || '').trim();
          if (repProgIds.has(pId)) {
            const sid = String(enr.studentId || enr.student_id || '').trim();
            if (sid) repEnrolledStudentIds.add(sid);
          }
        });

        repPrograms.forEach((p: any) => {
          if (Array.isArray(p.studentIds)) {
            p.studentIds.forEach((sid: any) => {
              if (sid) repEnrolledStudentIds.add(String(sid).trim());
            });
          }
          if (Array.isArray(p.representativeStudentIds)) {
            p.representativeStudentIds.forEach((sid: any) => {
              if (sid) repEnrolledStudentIds.add(String(sid).trim());
            });
          }
        });

        // Also add nationalId and studentCode of enrolled students to ensure bulletproof matching
        studentsList.forEach((s: any) => {
          const sid = String(s.id || '').trim();
          if (repEnrolledStudentIds.has(sid)) {
            if (s.studentCode) repEnrolledStudentIds.add(String(s.studentCode).trim().toUpperCase());
            if (s.nationalId) repEnrolledStudentIds.add(String(s.nationalId).trim());
          }
        });

        candidateIds.forEach(id => repEnrolledStudentIds.add(id));

        context = {
          isRepresentative: true,
          repEnrolledStudentIds,
          repProgramIds: Array.from(repProgIds)
        };
      }
    }
  }

  if (isStudentLevelUser(user) && collection !== 'students') {
    const identity = await resolveAuthoritativeStudentIdentity(user);
    context.studentCandidates = identity.candidates;
  }

  // 5. Use the shared canUserReadDoc logic for absolute, bulletproof row-level filtering consistency
  const filtered = rawItems.filter(item => canUserReadDoc(user, collection, item, context));
  if (collection === 'attendance' && isRegularStudentUser(user)) {
    const candidates = context.studentCandidates || getUserIdentityCandidates(user);
    return filtered.map(doc => sanitizeAttendanceDocForUser(doc, user, candidates));
  }
  return filtered;
}

export async function fetchBootstrapData(callerUserOrLevel: any, userRole?: string): Promise<Record<string, any[]>> {
  const callerUser = (typeof callerUserOrLevel === 'object' && callerUserOrLevel !== null)
    ? callerUserOrLevel
    : { level: callerUserOrLevel, role: userRole };

  const collections = [
    'students', 'teachers', 'programs', 'enrollments', 'study_periods',
    'classrooms', 'attendance', 'finance_expenses', 'finance_loans',
    'tuition_periods', 'tuition_records', 'student_requests',
    'workflow_items', 'system_users', 'academic_calendar_periods',
    'academic_holidays', 'article_evaluations', 'received_articles',
    'student_lockers', 'personal_todos', 'assigned_todos',
    'evaluation_requests', 'research', 'study_stats',
    'periodic_study_logs', 'study_daily_entries', 'discussion_groups', 'academic_sub_periods',
    'counseling_session_grades',
    'curriculum_subjects', 'curriculum_books', 'curriculum_chapters', 'student_course_progress',
    'student_portal_access_config', 'announcements', 'announcement_dismissals'
  ];

  const BATCH_SIZE = 6;
  const results: { col: string; items: any[] }[] = [];

  for (let i = 0; i < collections.length; i += BATCH_SIZE) {
    const batch = collections.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (col) => {
        try {
          const items = await serverQueryCollection(col, callerUser);
          return { col, items };
        } catch (e) {
          return { col, items: [] };
        }
      })
    );
    results.push(...batchResults);
  }

  const result: Record<string, any[]> = {};
  for (const { col, items } of results) {
    result[col] = items;
  }
  return result;
}

/**
 * Fix #12: One-time complete and permanent purge of all pre-existing students,
 * student user accounts, and residual student records across MySQL and server storage.
 * Guarded by 'purge_all_students_v1_1405' in system_migrations so newly added students after this migration are preserved.
 */
let hasStartedStudentPurgeV1 = false;
export async function executeOneTimeStudentPurgeV1(): Promise<void> {
  if (hasStartedStudentPurgeV1) return;
  hasStartedStudentPurgeV1 = true;

  try {
    const MIGRATION_KEY = 'purge_all_students_v1_1405';
    if (isMysqlConfigured) {
      const existingMigration = await MysqlRepository.getDocument('system_migrations', MIGRATION_KEY);
      if (existingMigration && existingMigration.completed) {
        return;
      }
    }

    console.log('[Student Purge V1] 🧹 آغاز پاکسازی کامل و دائمی تمامی طلاب و حساب‌های کاربری طلاب قدیمی...');

    // 1. Purge all student user accounts from memory, file, and MySQL users tables
    const removedUsers = await purgeAllStudentUsersFromStorage();

    if (isMysqlConfigured) {
      const pool = (await import('./databaseAbstraction')).getMysqlPool();
      if (pool) {
        // Hard-delete all rows in students and student-related dedicated tables
        const tablesToClear = [
          'students',
          'enrollments',
          'attendance',
          'periodic_study_logs',
          'study_daily_entries',
          'study_stats',
          'student_requests',
          'received_articles',
          'article_evaluations',
          'evaluation_requests',
          'tuition_records'
        ];
        for (const tbl of tablesToClear) {
          try {
            await pool.execute(`DELETE FROM \`${tbl}\``);
          } catch (e) {}
        }

        // Hard-delete all student-related collections from app_collections
        const collectionsToClear = [
          'students',
          'enrollments',
          'course_enrollments',
          'student_course_progress',
          'attendance',
          'periodic_study_logs',
          'study_daily_entries',
          'study_stats',
          'student_requests',
          'received_articles',
          'article_evaluations',
          'evaluation_requests',
          'tuition_records',
          'student_comments',
          'oral_exams',
          'counseling_session_grades',
          'discussion_groups',
          'course_selection_requests'
        ];
        for (const col of collectionsToClear) {
          try {
            await pool.execute(`DELETE FROM app_collections WHERE collection_name = ?`, [col]);
          } catch (e) {}
        }

        // Delete student user accounts from all_users, system_users, and app_collections
        try {
          await pool.execute(
            `DELETE FROM all_users WHERE (level = 3 AND role != 'teacher') OR role IN ('student', 'class_representative')`
          );
        } catch (e) {}
        try {
          await pool.execute(
            `DELETE FROM system_users WHERE (level = 3 AND role != 'teacher') OR role IN ('student', 'class_representative')`
          );
        } catch (e) {}

        for (const userCol of ['system_users', 'all_users', 'users']) {
          try {
            const docs = await MysqlRepository.queryCollection(userCol);
            for (const doc of docs || []) {
              const uname = String(doc.username || '').trim().toUpperCase();
              if (uname === 'SADEGH' || uname === 'RAHNAMA' || uname === 'SHAH' || uname === 'SHAHPOORI' || uname === 'MALI') continue;
              if (doc.role === 'teacher' || doc.level === 1 || doc.level === 2) continue;
              if (doc.level === 3 || doc.role === 'student' || doc.role === 'class_representative' || doc.studentId || doc.linkedStudentId) {
                await MysqlRepository.deleteDocument(userCol, doc.id || doc.username);
              }
            }
          } catch (e) {}
        }

        // Clean studentIds and representativeStudentIds from active programs
        try {
          const allPrograms = await MysqlRepository.queryCollection('programs');
          for (const prog of allPrograms || []) {
            if (prog && prog.id) {
              const cleanedProg = {
                ...prog,
                studentIds: [],
                representativeStudentIds: [],
                representativeNames: [],
                customRepresentative: ''
              };
              const { row, dedicatedTable } = prepareRecordForDedicatedTable('programs', cleanedProg);
              await MysqlRepository.saveDocument('programs', String(prog.id), cleanedProg);
              if (dedicatedTable) {
                await MysqlRepository.saveToDedicatedTable(dedicatedTable, row).catch(() => {});
              }
            }
          }
        } catch (e) {}

        // Empty assigned students from student_lockers
        try {
          const allLockers = await MysqlRepository.queryCollection('student_lockers');
          for (const locker of allLockers || []) {
            if (locker && locker.id && (locker.studentId || locker.status === 'occupied')) {
              const cleanedLocker = {
                ...locker,
                status: 'empty',
                studentId: undefined,
                studentName: undefined,
                studentGrade: undefined,
                assignedAt: undefined
              };
              await MysqlRepository.saveDocument('student_lockers', String(locker.id), cleanedLocker);
            }
          }
        } catch (e) {}
      }

      await MysqlRepository.saveDocument('system_migrations', MIGRATION_KEY, {
        id: MIGRATION_KEY,
        completed: true,
        completedAt: new Date().toISOString(),
        removedUsersCount: removedUsers
      });
    }

    invalidateCollectionCache();
    console.log(`[Student Purge V1] ✅ پاکسازی کامل طلاب و حساب‌های کاربری آنان با موفقیت انجام شد.`);
  } catch (err) {
    console.warn('[Student Purge V1 Notice]:', err);
  }
}

// Run one-time purge automatically shortly after server module initialization
setTimeout(() => {
  executeOneTimeStudentPurgeV1().catch(() => {});
}, 1500);

