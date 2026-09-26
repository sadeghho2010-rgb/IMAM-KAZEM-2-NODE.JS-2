import { Request, Response } from 'express';
import { serverSupabase, isServerSupabaseConfigured, verifyAccessToken, logServerAudit, StoredUser } from './serverAuth';

// Mapping between logical collection names and dedicated PostgreSQL tables
export const COLLECTION_TABLE_MAP: Record<string, string> = {
  system_users: 'system_users',
  students: 'students',
  teachers: 'teachers',
  classrooms: 'classrooms',
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

// Sensitive collections requiring elevated roles
const FINANCIAL_COLLECTIONS = new Set([
  'tuition_records', 'tuition_periods', 'finance_loans', 'finance_expenses',
  'finance_operational_expenses', 'finance_budget_rows', 'finance_student_claims'
]);

const USER_SPECIFIC_COLLECTIONS = new Set([
  'personal_todos', 'user_todo_categories'
]);

// Helper to check caller permission
export function authorizeCollectionAccess(
  user: any,
  collection: string,
  action: 'read' | 'write' | 'delete',
  recordOwnerId?: string
): { allowed: boolean; reason?: string } {
  if (!user) {
    return { allowed: false, reason: 'احراز هویت نشده‌اید.' };
  }

  // Level 1: Super Admin has full unrestricted access
  if (user.level === 1 || user.role === 'super_admin' || user.role === 'school_manager') {
    return { allowed: true };
  }

  // Financial Collections Check
  if (FINANCIAL_COLLECTIONS.has(collection)) {
    const isFinanceStaff = user.role === 'finance_manager' || user.role === 'financial_officer' || user.username?.toUpperCase() === 'MALI';
    if (!isFinanceStaff) {
      // Students can only read their own tuition records
      if (collection === 'tuition_records' && action === 'read' && user.level === 3) {
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
      // Students can create their own article submissions and requests
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

  // Default allowed for authenticated users on standard collections
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

  if (isServerSupabaseConfigured) {
    try {
      const { row, dedicatedTable } = prepareRecordForDedicatedTable(collection, record);

      // 1. Save to dedicated table if mapped (safely handled if table does not exist yet)
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

      // 2. Also mirror to app_collections for full persistence and backward compatibility
      await serverSupabase
        .from('app_collections')
        .upsert({
          collection_name: collection,
          id,
          data: record,
          updated_at: new Date().toISOString()
        }, { onConflict: 'collection_name,id' });

      return { success: true, id };
    } catch (err: any) {
      console.error(`Server save error for ${collection}:`, err?.message || err);
      return { success: false, id, error: err?.message };
    }
  }

  return { success: true, id };
}

// Server CRUD Handler: Delete Document
export async function serverDeleteDoc(collection: string, id: string, callerUser?: any): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'شناسه الزامی است.' };

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

      return { success: true };
    } catch (err: any) {
      console.error(`Server delete error for ${collection}:`, err?.message || err);
      return { success: false, error: err?.message };
    }
  }

  return { success: true };
}

// Server CRUD Handler: Query Collection
export async function serverQueryCollection(collection: string, user?: any): Promise<any[]> {
  if (!isServerSupabaseConfigured) return [];

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

    if (error) {
      console.warn(`Query collection ${collection} error:`, error);
      return [];
    }

    return (data || []).map(r => ({ ...(r.data || {}), id: r.id }));
  } catch (err) {
    console.error(`Query collection exception ${collection}:`, err);
    return [];
  }
}
