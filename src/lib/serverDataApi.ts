import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { serverSupabase, isServerSupabaseConfigured, verifyAccessToken, logServerAudit, StoredUser } from './serverAuth';
import { isMysqlConfigured, MysqlRepository } from './databaseAbstraction';

const COLLECTIONS_DIR = path.join(process.cwd(), 'data', 'collections');

function getCollectionFilePath(collection: string): string {
  return path.join(COLLECTIONS_DIR, `${collection}.json`);
}

function loadCollectionFromFile(collection: string): any[] {
  try {
    const filePath = getCollectionFilePath(collection);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn(`Could not read collection ${collection} from file:`, e);
  }
  return [];
}

function saveCollectionToFile(collection: string, items: any[]) {
  try {
    if (!fs.existsSync(COLLECTIONS_DIR)) {
      fs.mkdirSync(COLLECTIONS_DIR, { recursive: true });
    }
    fs.writeFileSync(getCollectionFilePath(collection), JSON.stringify(items, null, 2), 'utf-8');
  } catch (e) {
    console.warn(`Could not write collection ${collection} to file:`, e);
  }
}

// In-memory collection cache on server
const serverMemoryCollections = new Map<string, Map<string, any>>();

function getMemoryCollection(collection: string): Map<string, any> {
  let colMap = serverMemoryCollections.get(collection);
  if (!colMap) {
    colMap = new Map<string, any>();
    loadCollectionFromFile(collection).forEach(item => {
      if (item && item.id) {
        colMap!.set(item.id, item);
      }
    });
    serverMemoryCollections.set(collection, colMap);
  }
  return colMap;
}

// Real-time synchronization event bus
type RealtimeListener = (event: { collection: string; id: string; action: 'upsert' | 'delete'; timestamp: number }) => void;
const realtimeListeners = new Set<RealtimeListener>();

export function registerRealtimeListener(listener: RealtimeListener): () => void {
  realtimeListeners.add(listener);
  return () => realtimeListeners.delete(listener);
}

export function notifyRealtimeChange(collection: string, id: string, action: 'upsert' | 'delete') {
  const evt = { collection, id, action, timestamp: Date.now() };
  realtimeListeners.forEach(fn => {
    try { fn(evt); } catch (e) {}
  });
}

// Mapping between logical collection names and dedicated PostgreSQL/MySQL tables
export const COLLECTION_TABLE_MAP: Record<string, string> = {
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

// Sensitive collections requiring elevated roles
const FINANCIAL_COLLECTIONS = new Set([
  'tuition_records', 'tuition_periods', 'finance_loans', 'finance_expenses',
  'finance_operational_expenses', 'finance_budget_rows', 'finance_student_claims'
]);

const USER_SPECIFIC_COLLECTIONS = new Set([
  'personal_todos', 'user_todo_categories'
]);

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

// Public collections strictly limited to public calendars and holidays
const PUBLIC_READ_COLLECTIONS = new Set([
  'academic_holidays',
  'academic_calendar_periods',
  'school_events'
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

  // Level 1: Super Admin has full unrestricted access
  if (user.level === 1 || user.role === 'super_admin' || user.role === 'school_manager') {
    return { allowed: true };
  }

  // Student Profiles Access Policy:
  // Only Level 1 Admin or Education Managers can create, update, or delete student profiles
  if (collection === 'students' && (action === 'write' || action === 'delete')) {
    const isEduManager = user.role === 'education_manager' || user.role === 'education_officer';
    if (!isEduManager && user.level > 1) {
      return { allowed: false, reason: 'مدیریت و ایجاد/حذف مشخصات طلاب منحصراً در اختیار واحد آموزش و مدیریت است.' };
    }
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

  // Research and Article Evaluation
  if (collection === 'received_articles' || collection === 'evaluation_requests') {
    if (user.level === 3 && action === 'write') {
      return { allowed: true };
    }
  }

  // System Users Security Check (Strict: Only Level 1 or Authorized Managers)
  if (collection === 'system_users') {
    if (user.level > 1 && user.role !== 'education_manager') {
      return { allowed: false, reason: 'مشاهده و مدیریت کاربران سیستم منحصراً در اختیار مدیر ارشد است.' };
    }
  }

  // Audit Logs (Write is server-only, Read is Admin-only)
  if (collection === 'audit_logs') {
    if (action === 'delete' || action === 'write') return { allowed: false, reason: 'ویرایش یا حذف لاگ‌های امنیتی امکان‌پذیر نیست.' };
    if (action === 'read' && user.level > 1) return { allowed: false, reason: 'مشاهده لاگ‌های امنیتی منحصراً در اختیار مدیر ارشد است.' };
  }

  // Grade Mentor restrictions
  if (user.role === 'grade_mentor' && user.gradeLabel) {
    return { allowed: true };
  }

  // Education Managers
  if (user.role === 'education_manager' || user.role === 'education_officer') {
    return { allowed: true };
  }

  // Default allowed for authenticated users on educational collections (read only unless specified)
  return { allowed: true };
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
    case 'students':
      row.national_id = data.nationalId || data.national_id || null;
      row.student_code = data.studentCode || data.student_code || null;
      row.name = data.name || 'نامشخص';
      row.grade = data.grade || 'نامشخص';
      row.phone = data.phone || null;
      row.father_name = data.fatherName || data.father_name || null;
      row.is_active = data.isActive !== undefined ? Boolean(data.isActive) : true;
      break;

    case 'teachers':
      row.name = data.name || 'نامشخص';
      row.phone = data.phone || null;
      row.specialty = data.specialty || null;
      row.is_active = data.isActive !== undefined ? Boolean(data.isActive) : true;
      break;

    case 'classrooms':
      row.title = data.title || 'کلاس بدون عنوان';
      row.grade = data.grade || null;
      row.capacity = Number(data.capacity) || 20;
      break;

    case 'programs':
      row.title = data.title || 'برنامه بدون عنوان';
      row.grade = data.grade || 'نامشخص';
      row.teacher_id = data.teacherId || data.teacher_id || null;
      row.teacher_name = data.teacherName || data.teacher_name || null;
      row.term = data.term || null;
      break;

    case 'attendance':
      row.date = data.date || now.split('T')[0];
      row.grade = data.grade || 'نامشخص';
      row.program_id = data.programId || data.program_id || null;
      row.present_count = Number(data.presentCount) || 0;
      row.absent_count = Number(data.absentCount) || 0;
      break;

    case 'received_articles':
      row.student_id = data.studentId || data.student_id || 'unknown';
      row.student_name = data.studentName || data.student_name || null;
      row.grade = data.grade || null;
      row.title = data.title || 'مقاله بدون عنوان';
      row.field = data.field || null;
      row.word_count = Number(data.wordCount) || 0;
      row.status = data.status || 'submitted';
      break;

    case 'article_evaluations':
      row.article_id = data.articleId || data.article_id || id;
      row.title = data.title || 'جلسه ارزیابی';
      row.student_id = data.studentId || data.student_id || 'unknown';
      row.student_name = data.studentName || data.student_name || null;
      row.grade = data.grade || null;
      row.session_date = data.sessionDate || data.session_date || null;
      row.status = data.status || 'scheduled';
      break;

    case 'evaluation_requests':
      row.evaluation_id = data.evaluationId || data.evaluation_id || 'none';
      row.article_id = data.articleId || data.article_id || null;
      row.student_id = data.studentId || data.student_id || 'unknown';
      row.student_name = data.studentName || data.student_name || null;
      row.grade = data.grade || null;
      row.request_type = data.requestType || data.request_type || 'article_evaluation';
      row.status = data.status || 'pending';
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

// Server CRUD Handler: Save Document (Dedicated Table + App Collections Mirror)
export async function serverSaveDoc(collection: string, data: any, callerUser?: any): Promise<{ success: boolean; id: string; error?: string }> {
  if (!data) return { success: false, id: '', error: 'داده‌های ارسالی نامعتبر است.' };
  const id = data.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const record = { ...data, id };

  // Always update server memory & file cache
  const memCol = getMemoryCollection(collection);
  memCol.set(id, record);
  saveCollectionToFile(collection, Array.from(memCol.values()));

  // 1. If MySQL is configured, execute via MySQL Repository
  if (isMysqlConfigured) {
    try {
      await MysqlRepository.saveDocument(collection, id, record);
      notifyRealtimeChange(collection, id, 'upsert');
      return { success: true, id };
    } catch (mErr: any) {
      console.warn(`[MySQL Save Doc Error for ${collection}]:`, mErr?.message || mErr);
    }
  }

  // 2. If Supabase is configured, execute via Supabase
  if (isServerSupabaseConfigured) {
    try {
      const { row, dedicatedTable } = prepareRecordForDedicatedTable(collection, record);

      // Save to dedicated table if mapped
      if (dedicatedTable) {
        try {
          const { error: dedicatedError } = await serverSupabase
            .from(dedicatedTable)
            .upsert(row, { onConflict: 'id' });
          if (dedicatedError) {
            console.warn(`[Supabase Dedicated Table Notice] ${dedicatedTable}:`, dedicatedError.message);
          }
        } catch (dErr: any) {
          console.warn(`[Supabase Dedicated Table Bypass] ${dedicatedTable}:`, dErr?.message || dErr);
        }
      }

      // Also mirror to app_collections for full persistence and backward compatibility
      await serverSupabase
        .from('app_collections')
        .upsert({
          collection_name: collection,
          id,
          data: record,
          updated_at: new Date().toISOString()
        }, { onConflict: 'collection_name,id' });

      notifyRealtimeChange(collection, id, 'upsert');
      return { success: true, id };
    } catch (err: any) {
      console.error(`Server save error for ${collection}:`, err?.message || err);
    }
  }

  notifyRealtimeChange(collection, id, 'upsert');
  return { success: true, id };
}

// Server CRUD Handler: Delete Document
export async function serverDeleteDoc(collection: string, id: string, callerUser?: any): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'شناسه الزامی است.' };

  // Always update server memory & file cache
  const memCol = getMemoryCollection(collection);
  memCol.delete(id);
  saveCollectionToFile(collection, Array.from(memCol.values()));

  // 1. If MySQL is configured, execute via MySQL Repository
  if (isMysqlConfigured) {
    try {
      await MysqlRepository.deleteDocument(collection, id);
      notifyRealtimeChange(collection, id, 'delete');
      return { success: true };
    } catch (mErr: any) {
      console.warn(`[MySQL Delete Doc Error for ${collection}]:`, mErr?.message || mErr);
    }
  }

  // 2. If Supabase is configured
  if (isServerSupabaseConfigured) {
    try {
      const dedicatedTable = COLLECTION_TABLE_MAP[collection];
      if (dedicatedTable) {
        try {
          await serverSupabase
            .from(dedicatedTable)
            .delete()
            .eq('id', id);
        } catch (dErr) {
          console.warn(`[Supabase Dedicated Table Delete Bypass] ${dedicatedTable}:`, dErr);
        }
      }

      await serverSupabase
        .from('app_collections')
        .delete()
        .eq('collection_name', collection)
        .eq('id', id);

      notifyRealtimeChange(collection, id, 'delete');
      return { success: true };
    } catch (err: any) {
      console.error(`Server delete error for ${collection}:`, err?.message || err);
    }
  }

  notifyRealtimeChange(collection, id, 'delete');
  return { success: true };
}

// Internal helper to retrieve raw collection data without filtering
async function fetchRawCollectionData(collection: string): Promise<any[]> {
  // 1. If MySQL is configured, fetch from MySQL
  if (isMysqlConfigured) {
    try {
      const mysqlItems = await MysqlRepository.queryCollection(collection);
      if (mysqlItems && mysqlItems.length > 0) {
        return mysqlItems;
      }
    } catch (mErr: any) {
      console.warn(`[MySQL Raw Query Error for ${collection}]:`, mErr?.message || mErr);
    }
  }

  // 2. If Supabase is configured
  if (isServerSupabaseConfigured) {
    try {
      const dedicatedTable = COLLECTION_TABLE_MAP[collection];

      // Query from dedicated table if available
      if (dedicatedTable) {
        const { data, error } = await serverSupabase
          .from(dedicatedTable)
          .select('*');

        if (!error && data && data.length > 0) {
          return data.map((item: any) => {
            if (item.data && typeof item.data === 'object') {
              return { ...item.data, id: item.id };
            }
            return item;
          });
        }
      }

      // Fallback query to app_collections
      const { data, error } = await serverSupabase
        .from('app_collections')
        .select('id, data')
        .eq('collection_name', collection);

      if (!error && data && data.length > 0) {
        return (data || []).map(r => ({ ...(r.data || {}), id: r.id }));
      }
    } catch (err) {
      console.error(`Query raw collection exception ${collection}:`, err);
    }
  }

  // 3. Fallback to server memory and disk file cache
  const memCol = getMemoryCollection(collection);
  if (memCol.size > 0) {
    return Array.from(memCol.values());
  }

  return [];
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

    if (user.role === 'student' || user.level === 3) {
      const uUsername = String(user.username || '').trim().toUpperCase();
      const uStudentId = String(user.studentId || user.id || '').trim();
      const sId = String(doc.id || '').trim();
      const sCode = String(doc.studentCode || '').trim().toUpperCase();
      const sNat = String(doc.nationalId || doc.nationalCode || '').trim();
      return (uStudentId && sId === uStudentId) || (uUsername && (sCode === uUsername || sNat === uUsername));
    }

    if (user.role === 'class_representative') {
      const repGrade = user.gradeLabel || user.grade;
      return repGrade ? String(doc.grade || '').trim() === String(repGrade).trim() : false;
    }

    return false;
  }

  // 2. periodic_study_logs
  if (collection === 'periodic_study_logs') {
    if (user.role === 'student' || user.level === 3) {
      const uStudentId = String(user.studentId || user.linkedStudentId || user.id || '').trim();
      const docStudentId = String(doc.studentId || doc.student_id || '').trim();
      
      // Requirement 3: Fail-closed check
      if (!uStudentId || !docStudentId) {
        return false;
      }
      return uStudentId === docStudentId;
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
  if (collection === 'system_users') {
    return user.level === 1 || user.role === 'education_manager';
  }

  // 5. Personal Todos
  if (collection === 'personal_todos') {
    return doc.userId === user.id || doc.user_id === user.id;
  }

  // 6. Counseling Session Grades
  if (collection === 'counseling_session_grades') {
    if (user.role === 'teacher') {
      const teacherName = (user.name || user.fullName || '').trim();
      const cleanTeacher = cleanTeacherName(teacherName);
      const csTeacher = doc.teacherName || doc.counselorName || doc.teacher || '';
      return cleanTeacher && cleanTeacherName(csTeacher) === cleanTeacher;
    }
    if (user.role === 'student' || user.level === 3) {
      const uId = user.studentId || user.id;
      return doc.studentId === uId || doc.student_id === uId;
    }
  }

  return true;
}

// Internal helper to retrieve multiple raw documents by collection and candidate IDs
async function fetchRawDocumentsByIds(collection: string, ids: string[]): Promise<any[]> {
  if (!ids || ids.length === 0) return [];

  // 1. If MySQL is configured, fetch directly from MySQL with IN (...)
  if (isMysqlConfigured) {
    try {
      const mysqlDocs = await MysqlRepository.getDocumentsByIds(collection, ids);
      if (mysqlDocs && mysqlDocs.length > 0) return mysqlDocs;
    } catch (mErr: any) {
      console.warn(`[MySQL Get Docs Error for ${collection}]:`, mErr?.message || mErr);
    }
  }

  // 2. If Supabase is configured
  if (isServerSupabaseConfigured) {
    try {
      const { data, error } = await serverSupabase
        .from('app_collections')
        .select('id, data')
        .eq('collection_name', collection)
        .in('id', ids);

      if (!error && data) {
        return data.map(r => ({ ...(r.data || {}), id: r.id }));
      }
    } catch (err) {
      console.error(`Get raw documents exception ${collection}:`, err);
    }
  }

  return [];
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
  const allowedDocs = docs.filter(doc => canUserReadDoc(user, collection, doc));
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

  // 2. Fetch raw items
  const rawItems = await fetchRawCollectionData(collection);
  if (!rawItems || rawItems.length === 0) return [];

  // 3. Super Admins & School Managers have full access across all collections
  if (user.level === 1 || user.role === 'super_admin' || user.role === 'school_manager') {
    return rawItems;
  }

  // 4. Precompute Context for Teacher / Students collection if needed to avoid N+1 queries
  let context: any = {};
  if (collection === 'students' && user.role === 'teacher') {
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
  }

  // 5. Use the shared canUserReadDoc logic for absolute, bulletproof row-level filtering consistency
  return rawItems.filter(item => canUserReadDoc(user, collection, item, context));
}
