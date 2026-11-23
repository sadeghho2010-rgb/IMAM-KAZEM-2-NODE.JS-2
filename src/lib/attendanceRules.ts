import {
  AttendanceSessionLog,
  AttendanceSettings,
  AcademicHolidayItem,
  Student,
  StudentAttendanceDetail
} from '../types';
import { normalizeShamsiDateStr, toEnglishDigits } from './jalali';

export interface ResolvedAttendanceRules {
  /** تاخیر زیر این عدد (مثلاً زیر ۴ دقیقه) اصلاً تاخیر محسوب نمی‌شود و حضور عادی است. ۰ = غیرفعال */
  minLateMinutes: number;
  /** تاخیر بالای این عدد (مثلاً بالای ۱۵ دقیقه) غیبت غیرموجه محسوب می‌شود. ۰ = غیرفعال */
  maxLateAsAbsenceMinutes: number;
  /** هر چند تاخیر معادل ۱ غیبت در گزارش‌های تجمیعی بازه‌ای محسوب شود. ۰ = غیرفعال */
  latesPerAbsence: number;
  /** نحوه محاسبه وضعیت «نامشخص» در آمار و گزارش‌ها */
  unspecifiedCountAs: 'unspecified' | 'absent' | 'present' | 'late';
}

export const DEFAULT_ATTENDANCE_RULES: ResolvedAttendanceRules = {
  minLateMinutes: 4,
  maxLateAsAbsenceMinutes: 15,
  latesPerAbsence: 3,
  unspecifiedCountAs: 'unspecified'
};

export function resolveAttendanceRules(settings?: Partial<AttendanceSettings> | null): ResolvedAttendanceRules {
  const minLate = typeof settings?.minLateMinutes === 'number' && !Number.isNaN(settings.minLateMinutes)
    ? Math.max(0, Math.floor(settings.minLateMinutes))
    : DEFAULT_ATTENDANCE_RULES.minLateMinutes;

  const maxLate = typeof settings?.maxLateAsAbsenceMinutes === 'number' && !Number.isNaN(settings.maxLateAsAbsenceMinutes)
    ? Math.max(0, Math.floor(settings.maxLateAsAbsenceMinutes))
    : DEFAULT_ATTENDANCE_RULES.maxLateAsAbsenceMinutes;

  const latesPerAbs = typeof settings?.latesPerAbsence === 'number' && !Number.isNaN(settings.latesPerAbsence)
    ? Math.max(0, Math.floor(settings.latesPerAbsence))
    : DEFAULT_ATTENDANCE_RULES.latesPerAbsence;

  const unspec = settings?.unspecifiedCountAs || DEFAULT_ATTENDANCE_RULES.unspecifiedCountAs;

  return {
    minLateMinutes: minLate,
    maxLateAsAbsenceMinutes: maxLate,
    latesPerAbsence: latesPerAbs,
    unspecifiedCountAs: unspec
  };
}

export interface ClassifiedAttendanceResult {
  effectiveStatus: 'present' | 'absent' | 'excused' | 'late' | 'unspecified';
  /** آیا تاخیر به دلیل کمتر بودن از حداقل مجاز (مثلاً زیر ۴ دقیقه) بی‌اثر شده است؟ */
  ignoredLate: boolean;
  /** آیا تاخیر به دلیل بیشتر بودن از سقف مجاز به غیبت غیرموجه تبدیل شده است؟ */
  lateConvertedToAbsence: boolean;
  /** دقیقه تاخیر مؤثر (فقط برای تاخیرهای معتبر) */
  countedLateMinutes: number;
}

/**
 * ارزیابی وضعیت مؤثر یک رکورد حضور و غیاب بر اساس ضوابط تنظیم‌شده توسط مسئول آموزش
 */
export function classifyAttendanceRecord(
  item: Pick<StudentAttendanceDetail, 'status' | 'isExcused' | 'lateMinutes'>,
  rules: ResolvedAttendanceRules
): ClassifiedAttendanceResult {
  const rawStatus = item?.status;

  if (rawStatus === 'present') {
    return {
      effectiveStatus: 'present',
      ignoredLate: false,
      lateConvertedToAbsence: false,
      countedLateMinutes: 0
    };
  }

  if (rawStatus === 'excused') {
    return {
      effectiveStatus: 'excused',
      ignoredLate: false,
      lateConvertedToAbsence: false,
      countedLateMinutes: 0
    };
  }

  if (rawStatus === 'absent') {
    return {
      effectiveStatus: item?.isExcused ? 'excused' : 'absent',
      ignoredLate: false,
      lateConvertedToAbsence: false,
      countedLateMinutes: 0
    };
  }

  if (rawStatus === 'late') {
    const mins = typeof item?.lateMinutes === 'number' && !Number.isNaN(item.lateMinutes)
      ? item.lateMinutes
      : undefined;

    // 1. تاخیر زیر حداقل مجاز (مثلاً زیر ۴ دقیقه) اصلاً تاخیر حساب نمی‌شود -> حاضر
    if (mins !== undefined && mins >= 0 && rules.minLateMinutes > 0 && mins < rules.minLateMinutes) {
      return {
        effectiveStatus: 'present',
        ignoredLate: true,
        lateConvertedToAbsence: false,
        countedLateMinutes: 0
      };
    }

    // 2. تاخیر بالای سقف مجاز -> غیبت غیرموجه (یا موجه اگر موجه شده باشد)
    if (mins !== undefined && rules.maxLateAsAbsenceMinutes > 0 && mins > rules.maxLateAsAbsenceMinutes) {
      return {
        effectiveStatus: item?.isExcused ? 'excused' : 'absent',
        ignoredLate: false,
        lateConvertedToAbsence: true,
        countedLateMinutes: 0
      };
    }

    return {
      effectiveStatus: 'late',
      ignoredLate: false,
      lateConvertedToAbsence: false,
      countedLateMinutes: mins && mins > 0 ? mins : 0
    };
  }

  // وضعیت نامشخص (یا ثبت‌نشده)
  if (rules.unspecifiedCountAs === 'absent') {
    return { effectiveStatus: 'absent', ignoredLate: false, lateConvertedToAbsence: false, countedLateMinutes: 0 };
  }
  if (rules.unspecifiedCountAs === 'present') {
    return { effectiveStatus: 'present', ignoredLate: false, lateConvertedToAbsence: false, countedLateMinutes: 0 };
  }
  if (rules.unspecifiedCountAs === 'late') {
    return { effectiveStatus: 'late', ignoredLate: false, lateConvertedToAbsence: false, countedLateMinutes: 0 };
  }
  return { effectiveStatus: 'unspecified', ignoredLate: false, lateConvertedToAbsence: false, countedLateMinutes: 0 };
}

/**
 * محاسبه تعداد غیبت‌های معادل حاصل از تجمع تاخیرها در یک بازه زمانی
 */
export function computeLateConvertedAbsences(lateCount: number, rules: ResolvedAttendanceRules): number {
  if (!rules.latesPerAbsence || rules.latesPerAbsence <= 0) return 0;
  return Math.floor(Math.max(0, lateCount) / rules.latesPerAbsence);
}

/**
 * یکپارچه‌سازی لاگ‌های حضور و غیاب (حذف تکرار احتمالی یک جلسه در یک روز برای جلوگیری از دوبارشماری)
 */
export function consolidateAttendanceLogs(logs: AttendanceSessionLog[]): AttendanceSessionLog[] {
  const bySessionKey = new Map<string, AttendanceSessionLog>();

  const getLogTimestamp = (log: AttendanceSessionLog): number => {
    const raw = log.updatedAt || log.recordedAt || (log as any).createdAt || 0;
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  (logs || []).forEach(log => {
    if (!log) return;
    const normDate = normalizeShamsiDateStr(log.date || '');
    const dateDigits = toEnglishDigits(normDate).replace(/[\/\-]/g, '');
    const progKey = String(log.programId || log.programTitle || log.id || '').trim();
    const sessionKey = `${progKey}__${dateDigits}`;

    const existing = bySessionKey.get(sessionKey);
    if (!existing) {
      bySessionKey.set(sessionKey, log);
      return;
    }

    const existingTs = getLogTimestamp(existing);
    const currentTs = getLogTimestamp(log);

    // Prefer the newer document; if timestamps tie, prefer the one with more student entries
    if (currentTs > existingTs) {
      bySessionKey.set(sessionKey, log);
    } else if (currentTs === existingTs) {
      const curLen = Array.isArray(log.students) ? log.students.length : 0;
      const prevLen = Array.isArray(existing.students) ? existing.students.length : 0;
      if (curLen >= prevLen) {
        bySessionKey.set(sessionKey, log);
      }
    }
  });

  return Array.from(bySessionKey.values());
}

/**
 * بررسی تعطیلی رسمی در تقویم آموزشی برای یک تاریخ و پایه
 */
export function isDateOfficialHoliday(
  dateStr: string,
  grade: string | undefined,
  holidays: AcademicHolidayItem[]
): boolean {
  if (!dateStr || !Array.isArray(holidays) || holidays.length === 0) return false;
  const norm = normalizeShamsiDateStr(dateStr);
  if (!norm) return false;

  return holidays.some(h => {
    const hStart = normalizeShamsiDateStr(h.startDate || '');
    const hEnd = normalizeShamsiDateStr(h.endDate || h.startDate || '');
    if (!hStart) return false;
    const inDates = norm >= hStart && norm <= hEnd;
    if (!inDates) return false;
    if (!h.grades || h.grades.length === 0 || h.grades.includes('all')) return true;
    if (!grade) return true;
    return h.grades.some(g => g === 'all' || g === grade || grade.includes(g) || g.includes(grade));
  });
}

/**
 * ساخت نگاشت چندکلیدی برای تطبیق دقیق شناسه/کدملی/کد طلبگی/نام طلبه
 */
export function buildStudentCanonicalMatcher(students: Student[]) {
  const normalizePersian = (val?: string) =>
    toEnglishDigits(String(val || ''))
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const idMap = new Map<string, string>();
  const nameMap = new Map<string, string>();

  (students || []).forEach(s => {
    if (!s?.id) return;
    const canonical = String(s.id);
    idMap.set(canonical, canonical);
    if (s.studentCode) idMap.set(toEnglishDigits(String(s.studentCode)).trim(), canonical);
    if (s.nationalId) idMap.set(toEnglishDigits(String(s.nationalId)).trim(), canonical);
    if (s.managementCenterCode) idMap.set(toEnglishDigits(String(s.managementCenterCode)).trim(), canonical);
    if (s.name) {
      const normName = normalizePersian(s.name);
      if (normName && !nameMap.has(normName)) {
        nameMap.set(normName, canonical);
      }
    }
  });

  return (rec: Pick<StudentAttendanceDetail, 'studentId' | 'nationalId' | 'studentName'>): string | undefined => {
    const sid = rec?.studentId ? toEnglishDigits(String(rec.studentId)).trim() : '';
    if (sid && idMap.has(sid)) return idMap.get(sid);

    const nat = rec?.nationalId ? toEnglishDigits(String(rec.nationalId)).trim() : '';
    if (nat && idMap.has(nat)) return idMap.get(nat);

    const normName = normalizePersian(rec?.studentName);
    if (normName && nameMap.has(normName)) return nameMap.get(normName);

    return undefined;
  };
}
