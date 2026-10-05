/**
 * Database Save Error Tracker & Logger Engine
 * Logs detailed failure reports whenever a database write operation fails or times out.
 */

import { localDb } from './localDb';

export interface DbSaveErrorLog {
  id: string;
  collectionName: string;         // e.g. 'student_requests', 'attendance', 'students', 'meals', 'tuition'
  moduleLabel: string;            // e.g. 'پنل رسیدگی به درخواست طلاب', 'حضور و غیاب طلاب', 'ثبت و ویرایش طلاب'
  recordId?: string;              // e.g. 'req_12345'
  recordSummary?: string;         // e.g. 'ثبت درخواست مرخصی تحصیلی برای طلبه علی حسینی'
  causeType: 'no_connection' | 'table_not_found' | 'permission_denied' | 'timeout' | 'unknown';
  causeTitle: string;             // e.g. 'عدم اتصال به دیتابیس (قطعی اینترنت یا سرور)'
  causeDescription: string;       // Detailed Persian explanation of the failure
  rawErrorMessage?: string;       // Technical error text
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  userLevel: number;
  userIp?: string;
  isResolved?: boolean;
  resolutionNote?: string;
}

export function resolveModuleLabel(collectionName: string): string {
  const map: Record<string, string> = {
    students: 'مدیریت کل طلاب',
    'active-students': 'طلاب فعال',
    programs: 'برنامه‌های آموزشی و دروس',
    classrooms: 'مدرس‌ها و کلاس‌های درس',
    attendance: 'حضور و غیاب طلاب',
    student_requests: 'پنل رسیدگی به درخواست طلاب',
    todos: 'پیگیری‌ها و تسک‌های جاری',
    workflow: 'جریان کار و کارتابل تاییدات',
    student_meals: 'رزرو نهار و شام طلاب',
    finance_student_claims: 'مطالبات و بدهی‌های مالی',
    student_activity_tuition: 'محاسبه شهریه طلاب',
    grade_professors_compensation: 'حق‌الزحمه اساتید پایه',
    teachers_compensation: 'حق‌التدریس اساتید',
    lunch_management: 'اطلاعات نهار و شام',
    fund_and_active_loans: 'صندوق قرض‌الحسنه و وام‌ها',
    expenses_and_reports: 'هزینه‌ها و بودجه',
    research: 'بخش پژوهش و مقالات',
    research_records: 'ارزیابی مقالات علمی',
    comments: 'نظرات و ارزیابی‌های تربیتی',
    counseling: 'کلاس‌های مشاوره',
    course_selection: 'سامانه انتخاب واحد',
    oral_exams: 'آزمون شفاهی فقه و اصول',
    lockers: 'اختصاص کمد به طلاب',
    teachers_bank: 'بانک جامع اساتید',
    staff_bank: 'بانک کارکنان و پرسنل',
    teacher_transport: 'سرویس و ایاب و ذهاب اساتید',
    system_users: 'مدیریت کاربران و دسترسی‌ها',
    audit_logs: 'فعالیت‌های سایت'
  };
  return map[collectionName] || `بخش ${collectionName}`;
}

export function classifyErrorCause(errMsg: string = ''): {
  causeType: 'no_connection' | 'table_not_found' | 'permission_denied' | 'timeout' | 'unknown';
  causeTitle: string;
  causeDescription: string;
} {
  const lower = errMsg.toLowerCase();
  
  if (lower.includes('42p01') || lower.includes('does not exist') || lower.includes('relation') || lower.includes('table')) {
    return {
      causeType: 'table_not_found',
      causeTitle: 'عدم وجود جدول/مجموعه مربوطه در دیتابیس (Table or Collection Not Found)',
      causeDescription: 'جدول یا اسکیما (Schema) مربوط به این بخش در دیتابیس سرور وجود ندارد یا نام آن نامعتبر است.'
    };
  }

  if (lower.includes('fetch failed') || lower.includes('failed to fetch') || lower.includes('network') || lower.includes('offline') || lower.includes('اتصال') || lower.includes('econnrefused')) {
    return {
      causeType: 'no_connection',
      causeTitle: 'عدم اتصال به دیتابیس (قطع بودن اینترنت یا سرور)',
      causeDescription: 'ارتباط دستگاه کاربر با دیتابیس ابری/سرور قطع شده است. ممکن است اینترنت کاربر قطع شده و یا سرور پایگاه داده در دسترس نباشد.'
    };
  }

  if (lower.includes('42501') || lower.includes('permission') || lower.includes('rls') || lower.includes('denied') || lower.includes('unauthorized') || lower.includes('دسترسی')) {
    return {
      causeType: 'permission_denied',
      causeTitle: 'عدم لغو دسترسی / سطح دسترسی ناکافی (Permission Denied / RLS)',
      causeDescription: 'کاربر جاری یا توکن امنیتی، اجازه نگارش و ذخیره‌سازی داده در این بخش از دیتابیس را بر اساس سطح دسترسی ندارد.'
    };
  }

  if (lower.includes('timeout') || lower.includes('4000ms') || lower.includes('4s') || lower.includes('تایم‌اوت')) {
    return {
      causeType: 'timeout',
      causeTitle: 'خطای تایم‌اوت و کندی دیتابیس (Database Timeout)',
      causeDescription: 'پاسخ ذخیره‌سازی از سوی دیتابیس بیش از مهلت ۴ ثانیه‌ای زمان برد و به علت افت سرعت شبکه لغو گردید.'
    };
  }

  return {
    causeType: 'unknown',
    causeTitle: 'خطای عمومی پایگاه داده در نگارش اطلاعات',
    causeDescription: errMsg || 'اطلاعات در حین ارسال به دیتابیس با پاسخ ناموفق مواجه گردید.'
  };
}

export async function recordDatabaseSaveError(params: {
  collectionName: string;
  recordId?: string;
  recordSummary?: string;
  rawError?: string | Error;
  causeType?: 'no_connection' | 'table_not_found' | 'permission_denied' | 'timeout' | 'unknown';
  customTitle?: string;
  customDesc?: string;
}): Promise<DbSaveErrorLog> {
  let currentUserObj: any = null;
  try {
    const savedUser = localStorage.getItem('system_auth_current_user_v2') || localStorage.getItem('current_user');
    if (savedUser) currentUserObj = JSON.parse(savedUser);
  } catch {}

  const rawErrMsg = typeof params.rawError === 'string' ? params.rawError : (params.rawError?.message || 'خطای عدم لغو ذخیره‌سازی در دیتابیس');
  const causeInfo = classifyErrorCause(rawErrMsg);

  const errorLog: DbSaveErrorLog = {
    id: `dberr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    collectionName: params.collectionName,
    moduleLabel: resolveModuleLabel(params.collectionName),
    recordId: params.recordId,
    recordSummary: params.recordSummary || `تلاش برای ثبت/ویرایش داده در ${resolveModuleLabel(params.collectionName)}`,
    causeType: params.causeType || causeInfo.causeType,
    causeTitle: params.customTitle || causeInfo.causeTitle,
    causeDescription: params.customDesc || causeInfo.causeDescription,
    rawErrorMessage: rawErrMsg,
    timestamp: new Date().toISOString(),
    userId: currentUserObj?.id || currentUserObj?.username || 'user_unknown',
    userName: currentUserObj?.name || currentUserObj?.fullName || currentUserObj?.username || 'کاربر مسئول بخش',
    userRole: currentUserObj?.roleTitle || currentUserObj?.role || 'مسئول بخش',
    userLevel: Number(currentUserObj?.level || 2),
    isResolved: false
  };

  try {
    await localDb.saveDoc('db_save_errors', errorLog);
  } catch (e) {
    try {
      const existing = JSON.parse(localStorage.getItem('db_save_errors_fallback') || '[]');
      existing.unshift(errorLog);
      localStorage.setItem('db_save_errors_fallback', JSON.stringify(existing.slice(0, 100)));
    } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('db_save_error_logged', { detail: errorLog }));
  }

  return errorLog;
}
