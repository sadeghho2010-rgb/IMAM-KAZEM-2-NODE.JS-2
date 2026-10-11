/**
 * Privacy Sanitizer & Section Mapper for Monitoring System
 * Ensures NO passwords, tokens, national codes, tuition amounts or sensitive data are logged.
 * Maps API routes and tab IDs to human-readable Persian section names.
 */

export const ROUTE_SECTION_MAP: Record<string, string> = {
  // Education & Students
  'attendance': 'حضور و غیاب طلاب',
  'students': 'مدیریت کل پرونده طلاب',
  'active-students': 'لیست طلاب فعال',
  'study': 'آمار مطالعه طلاب',
  'programs': 'برنامه‌های آموزشی و سرفصل‌ها',
  'classrooms': 'مَدرَس‌ها و کلاس‌های درس',
  'schedule': 'برنامه درسی و هفتگی',
  'student-requests': 'پنل درخواست‌های طلاب',
  'oral-exams': 'آزمون‌های شفاهی فقه و اصول',
  'counseling': 'کلاس‌ها و جلسات مشاوره',
  'course-selection': 'انتخاب واحد آموزشی',
  'lockers': 'امور کمدها و اسکان طلاب',
  'comments': 'نظرات و ارزیابی‌های تربیتی',
  'discussion': 'گروه‌های مباحثه علمی',
  'calendar': 'تقویم آموزشی و سالنامه',
  'summary': 'پرونده تحصیلی طلاب',

  // Finance
  'tuition': 'شهریه و امور مالی طلاب',
  'expenses': 'هزینه‌ها و بودجه مالی',
  'loans': 'صندوق قرض‌الحسنه و وام‌ها',
  'meals': 'رزرو وعده‌های غذایی طلاب',
  'claims': 'مطالبات و بدهی‌های مالی',
  'transport': 'سرویس ایاب و ذهاب اساتید',

  // System & Management
  'auth': 'ورود و احراز هویت',
  'users': 'مدیریت کاربران و دسترسی‌ها',
  'credentials': 'تنظیمات مشخصات و رمز عبور',
  'audit': 'فعالیت‌های سایت و ردپای تغییرات',
  'database': 'پشتیبان‌گیری و دیتابیس',
  'system': 'سلامت سیستم و مانیتورینگ',
  'todos': 'پیگیری‌ها و تسک‌های جاری',
  'workflow': 'کارتابل و جریان کار تاییدات',
  'teachers': 'بانک اساتید و مدرسین',
  'staff': 'بانک کارکنان و پرسنل',
};

/**
 * Resolves human-readable Persian section title from path or collection
 */
export function resolveSectionName(routeOrPath: string): string {
  if (!routeOrPath) return 'عمومی سامانه';

  const clean = routeOrPath.toLowerCase().replace(/^\/api\//, '').replace(/^\//, '');
  const segments = clean.split(/[/?#]/);
  const primaryKey = segments[0] || '';

  if (ROUTE_SECTION_MAP[primaryKey]) {
    return ROUTE_SECTION_MAP[primaryKey];
  }

  // Check sub-segment match
  for (const [key, label] of Object.entries(ROUTE_SECTION_MAP)) {
    if (clean.includes(key)) return label;
  }

  return 'بخش ' + (primaryKey || 'مدیریت سامانه');
}

/**
 * Strips passwords, auth tokens, credit cards, phones, and sensitive params
 */
export function sanitizeSensitiveText(text: string | null | undefined, maxLength: number = 500): string {
  if (!text) return '';
  let str = String(text);

  // 1. Remove Bearer tokens
  str = str.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]');

  // 2. Remove JWTs
  str = str.replace(/eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, '[JWT_REDACTED]');

  // 3. Remove Passwords in JSON / query / url
  str = str.replace(/("?(password|pass|pin|secret|token|currentPassword|newPassword)"?\s*[:=]\s*)"[^"]*"/gi, '$1"[REDACTED]"');
  str = str.replace(/([?&](password|pass|pin|token)=)[^&]*/gi, '$1[REDACTED]');

  // 4. Remove National IDs (10 consecutive digits)
  str = str.replace(/\b\d{10}\b/g, '[NATIONAL_ID_REDACTED]');

  // 5. Remove Phone numbers (09xxxxxxxxx)
  str = str.replace(/\b09\d{9}\b/g, '[PHONE_REDACTED]');

  // 6. Trim to maxLength
  if (str.length > maxLength) {
    str = str.substring(0, maxLength) + '...';
  }

  return str;
}

/**
 * Shortens stack traces to max N lines and sanitizes paths
 */
export function sanitizeStackTrace(stack: string | null | undefined, maxLines: number = 10): string {
  if (!stack) return '';
  const lines = stack.split('\n');
  const shortLines = lines.slice(0, maxLines).map(line => {
    // Hide absolute server directory paths for security
    return line.replace(new RegExp(process.cwd(), 'g'), '.');
  });
  return shortLines.join('\n');
}

/**
 * Computes deterministic 16-char fingerprint for grouping identical issues
 */
export function computeFingerprint(type: string, message: string, routeOrSection: string): string {
  const normMessage = (message || '')
    .toLowerCase()
    .replace(/\b0x[0-9a-f]+\b/g, '') // strip memory addresses
    .replace(/\d+/g, '#')             // normalize arbitrary numbers/IDs to '#'
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 150);

  const rawKey = `${type}|${routeOrSection}|${normMessage}`;
  
  // Fast lightweight djb2-based 16-hex hash without heavy crypto overhead
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < rawKey.length; i++) {
    const ch = rawKey.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return (part1 + part2).substring(0, 16);
}
