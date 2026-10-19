import * as jalaali from 'jalaali-js';

export interface ShamsiDateParts {
  year: number;
  month: number;
  day: number;
}

export const SHAMSI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export const SHAMSI_WEEKDAY_NAMES = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
];

export const SHAMSI_WEEKDAY_NAMES_SHORT = [
  'ش',
  'ی',
  'د',
  'س',
  'چ',
  'پ',
  'ج',
];

// Convert digits to English
export function toEnglishDigits(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
}

// Convert digits to Persian
export function toPersianDigits(n: number | string): string {
  if (n === undefined || n === null) return '';
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
}

// Parse "1405/06/15" or "1405-06-15"
export function parseShamsiDate(shamsiStr: string): ShamsiDateParts {
  const cleaned = toEnglishDigits(shamsiStr).trim().replace(/-/g, '/');
  const parts = cleaned.split('/');
  if (parts.length !== 3) {
    return { year: 1405, month: 1, day: 1 };
  }
  const year = parseInt(parts[0], 10) || 1405;
  const month = parseInt(parts[1], 10) || 1;
  const day = parseInt(parts[2], 10) || 1;
  return { year, month, day };
}

// Format parts into "1405/06/15"
export function formatShamsiDate(year: number, month: number, day: number): string {
  const yStr = String(year).padStart(4, '0');
  const mStr = String(month).padStart(2, '0');
  const dStr = String(day).padStart(2, '0');
  return `${yStr}/${mStr}/${dStr}`;
}

// Normalize Shamsi Date into standard English digits YYYY/MM/DD with leading zeroes
// Handles: "1405/7/22", "22/7/1405", "۱۴۰۵/۰۷/۲۲", "1405-7-22", etc.
export function normalizeShamsiDateStr(raw?: string): string {
  if (!raw) return '';
  const eng = toEnglishDigits(raw).trim().replace(/-/g, '/');
  const parts = eng.split('/').map(p => p.trim());
  if (parts.length === 3) {
    // If format is DD/MM/YYYY (day first, 4-digit year last)
    if (parts[0].length <= 2 && parts[2].length === 4) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}/${m}/${d}`;
    }
    const y = parts[0].padStart(4, '0');
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${y}/${m}/${d}`;
  }
  return eng;
}

// Convert Shamsi string "1405/06/15" to JS Date
export function shamsiToDate(shamsiStr: string): Date {
  try {
    const { year, month, day } = parseShamsiDate(shamsiStr);
    const safeYear = Math.max(1300, Math.min(1500, year || 1405));
    const safeMonth = Math.max(1, Math.min(12, month || 1));
    const safeDay = Math.max(1, Math.min(31, day || 1));
    const { gy, gm, gd } = jalaali.toGregorian(safeYear, safeMonth, safeDay);
    return new Date(gy, gm - 1, gd, 12, 0, 0); // Noon to avoid timezone boundary shifts
  } catch (e) {
    return new Date();
  }
}

// Convert JS Date to Shamsi string "1405/06/15"
export function dateToShamsi(date: Date): string {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const { jy, jm, jd } = jalaali.toJalaali(gy, gm, gd);
  return formatShamsiDate(jy, jm, jd);
}

// Get today in Shamsi
export function getTodayShamsi(): string {
  return dateToShamsi(new Date());
}

// Get day of week: 0 = شنبه, 1 = یکشنبه, ..., 5 = پنج‌شنبه, 6 = جمعه
export function getShamsiDayOfWeek(shamsiStr: string): number {
  const date = shamsiToDate(shamsiStr);
  const jsDay = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  // Map JS day (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat) to Persian (0=Sat, 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri)
  const map: Record<number, number> = {
    6: 0, // Saturday -> 0 (شنبه)
    0: 1, // Sunday -> 1 (یکشنبه)
    1: 2, // Monday -> 2 (دوشنبه)
    2: 3, // Tuesday -> 3 (سه‌شنبه)
    3: 4, // Wednesday -> 4 (چهارشنبه)
    4: 5, // Thursday -> 5 (پنج‌شنبه)
    5: 6, // Friday -> 6 (جمعه)
  };
  return map[jsDay] ?? 0;
}

// Get weekday name
export function getShamsiDayOfWeekName(shamsiStr: string): string {
  const idx = getShamsiDayOfWeek(shamsiStr);
  return SHAMSI_WEEKDAY_NAMES[idx] || 'شنبه';
}

// Get month name
export function getShamsiMonthName(monthNumber: number): string {
  return SHAMSI_MONTH_NAMES[monthNumber - 1] || '';
}

// Days in a Shamsi month
export function getDaysInShamsiMonth(year: number, month: number): number {
  return jalaali.jalaaliMonthLength(year, month);
}

// Compare two Shamsi date strings ("1405/06/15" vs "1406/01/01")
export function compareShamsi(a: string, b: string): number {
  const pA = parseShamsiDate(a);
  const pB = parseShamsiDate(b);
  if (pA.year !== pB.year) return pA.year - pB.year;
  if (pA.month !== pB.month) return pA.month - pB.month;
  return pA.day - pB.day;
}

// Check if target date is between start and end (inclusive)
export function isDateBetween(target: string, start: string, end: string): boolean {
  return compareShamsi(target, start) >= 0 && compareShamsi(target, end) <= 0;
}

// Generate all Shamsi date strings between start and end inclusive
export function generateShamsiDateRange(startShamsi: string, endShamsi: string): string[] {
  if (!startShamsi || !endShamsi) return [];
  if (compareShamsi(startShamsi, endShamsi) > 0) return [];
  
  const results: string[] = [];
  const current = shamsiToDate(startShamsi);
  const end = shamsiToDate(endShamsi);

  if (isNaN(current.getTime()) || isNaN(end.getTime())) return [];

  let safety = 0;
  while (current.getTime() <= end.getTime() && safety < 1500) {
    results.push(dateToShamsi(current));
    current.setDate(current.getDate() + 1);
    safety++;
  }

  return results;
}

// Calculate total days between start and end inclusive
export function calculateDaysBetween(startShamsi: string, endShamsi: string): number {
  const dates = generateShamsiDateRange(startShamsi, endShamsi);
  return dates.length;
}

/**
 * Calculate the standard Iranian payroll/attendance cycle from the 21st of one month to the 20th of the next month.
 * @param todayShamsi Current Shamsi date string e.g. "1403/07/25"
 * @param monthOffset Shift cycle by N months (0 = current cycle, -1 = previous cycle, +1 = next cycle)
 */
export function getShamsi21To20Cycle(todayShamsi: string, monthOffset: number = 0): {
  start: string;
  end: string;
  title: string;
} {
  const parts = parseShamsiDate(todayShamsi);
  let startYear = parts.year;
  let startMonth = parts.month;

  // If day is before 21st, the current cycle started on 21st of previous month
  if (parts.day < 21) {
    if (startMonth === 1) {
      startMonth = 12;
      startYear -= 1;
    } else {
      startMonth -= 1;
    }
  }

  // Apply monthOffset
  startMonth += monthOffset;
  while (startMonth > 12) {
    startMonth -= 12;
    startYear += 1;
  }
  while (startMonth < 1) {
    startMonth += 12;
    startYear -= 1;
  }

  // End month calculation (always 1 month after startMonth)
  let endYear = startYear;
  let endMonth = startMonth + 1;
  if (endMonth > 12) {
    endMonth = 1;
    endYear += 1;
  }

  const start = formatShamsiDate(startYear, startMonth, 21);
  const end = formatShamsiDate(endYear, endMonth, 20);

  const startMonthName = SHAMSI_MONTH_NAMES[startMonth - 1];
  const endMonthName = SHAMSI_MONTH_NAMES[endMonth - 1];
  const yearTitle = startYear === endYear ? `${startYear}` : `${startYear}/${endYear}`;

  const title = `کارکرد ۲۱ ${startMonthName} الی ۲۰ ${endMonthName} ${yearTitle}`;

  return { start, end, title };
}

// Subtract days from a Shamsi date string e.g. "1405/06/15" -> "1405/06/12"
export function subtractDaysShamsi(shamsiStr: string, days: number): string {
  if (!days || days <= 0) return shamsiStr;
  try {
    const d = shamsiToDate(shamsiStr);
    d.setDate(d.getDate() - days);
    return dateToShamsi(d);
  } catch (e) {
    return shamsiStr;
  }
}

/**
 * Intelligently consolidates all matching attendance session logs for a given program and date into a single merged session log.
 * Prevents data loss when multiple students submit self-reporting separately or when multiple session logs exist.
 */
export function getConsolidatedSessionLog(
  logs: any[],
  programId: string,
  dateStr: string,
  progTitle?: string
): any | undefined {
  if (!logs || !Array.isArray(logs) || logs.length === 0 || (!programId && !progTitle) || !dateStr) {
    return undefined;
  }

  const normTargetDate = normalizeShamsiDateStr(dateStr);
  const targetCleanDigits = toEnglishDigits(normTargetDate).replace(/[\/\-]/g, '');

  const matchingLogs = logs.filter(l => {
    if (!l) return false;
    const p1 = String(l.programId || l.program_id || '').trim();
    const p2 = String(programId || '').trim();
    const idMatch = (p1 && p2 && (p1 === p2 || p1.toLowerCase() === p2.toLowerCase())) ||
                    (l.id && typeof l.id === 'string' && p2 && (l.id.startsWith(`${p2}_`) || l.id === p2)) ||
                    (progTitle && l.programTitle && String(l.programTitle).trim() === String(progTitle).trim());

    if (!idMatch) return false;

    const logNormDate = normalizeShamsiDateStr(l.date);
    const logCleanDigits = toEnglishDigits(logNormDate).replace(/[\/\-]/g, '');
    return Boolean(logCleanDigits && targetCleanDigits && logCleanDigits === targetCleanDigits);
  });

  if (matchingLogs.length === 0) return undefined;

  // Combine all students from matching logs into a single Map keyed by student identifier
  const studentMap = new Map<string, any>();
  const baseLog = matchingLogs[0];

  let isCancelled = false;
  let cancellationReason = '';
  let hasSubstituteTeacher = false;
  let substituteTeacherName = '';
  let substituteTeacherNotes = '';

  matchingLogs.forEach(log => {
    if (log.isCancelled) {
      isCancelled = true;
      if (log.cancellationReason) cancellationReason = log.cancellationReason;
    }
    if (log.hasSubstituteTeacher) {
      hasSubstituteTeacher = true;
      if (log.substituteTeacherName) substituteTeacherName = log.substituteTeacherName;
      if (log.substituteTeacherNotes) substituteTeacherNotes = log.substituteTeacherNotes;
    }

    if (Array.isArray(log.students)) {
      log.students.forEach((s: any) => {
        if (!s) return;
        const key = String(s.studentId || s.nationalId || s.studentName || '').trim().toLowerCase();
        if (!key) return;

        const existing = studentMap.get(key);
        if (!existing) {
          studentMap.set(key, { ...s });
        } else {
          // Prefer non-unspecified status over unspecified; prefer newer timestamp
          const isSValid = s.status && s.status !== 'unspecified';
          const isExValid = existing.status && existing.status !== 'unspecified';
          const isBetterStatus = isSValid && !isExValid;
          const isNewer = s.selfReportedAt && (!existing.selfReportedAt || s.selfReportedAt > existing.selfReportedAt);

          if (isBetterStatus || isNewer) {
            studentMap.set(key, { ...existing, ...s });
          } else {
            studentMap.set(key, { ...s, ...existing });
          }
        }
      });
    }
  });

  const mergedStudents = Array.from(studentMap.values());
  const presentCount = mergedStudents.filter((s: any) => s.status === 'present').length;
  const absentCount = mergedStudents.filter((s: any) => s.status === 'absent').length;
  const lateCount = mergedStudents.filter((s: any) => s.status === 'late').length;

  const stdCleanDate = normTargetDate.replace(/\//g, '-');

  return {
    ...baseLog,
    id: `${programId}_${stdCleanDate}`,
    programId,
    date: normTargetDate,
    isCancelled,
    cancellationReason: isCancelled ? cancellationReason : undefined,
    hasSubstituteTeacher,
    substituteTeacherName: hasSubstituteTeacher ? substituteTeacherName : undefined,
    substituteTeacherNotes: hasSubstituteTeacher ? substituteTeacherNotes : undefined,
    students: mergedStudents,
    presentCount,
    absentCount,
    lateCount,
    totalCount: mergedStudents.length
  };
}

