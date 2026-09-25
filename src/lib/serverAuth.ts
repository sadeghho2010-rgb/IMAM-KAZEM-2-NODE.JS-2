import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export interface SafeUser {
  id: string;
  username: string;
  name: string;
  fullName?: string;
  level: number;
  role: string;
  roleTitle?: string;
  scope: string;
  gradeLabel: string;
  mentorId?: string;
  studentId?: string;
  studentName?: string;
  linkedStudentId?: string;
  isReadOnly?: boolean;
  canEdit?: boolean;
  canManageUsers?: boolean;
  canBackup?: boolean;
  avatarBg?: string;
  allowedTabs: string[];
  allowedModules?: string[];
  lastLogin?: string;
  mustChangePassword?: boolean;
  accountLockedUntil?: string;
  failedLoginAttempts?: number;
}

export interface StoredUser extends SafeUser {
  password?: string;
  passwordHash?: string;
  failedLoginAttempts?: number;
  accountLockedUntil?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'x9Kf8Nm2Qr7Lp4Wz1Tb6Vy0Cj3Hs5Ga8De1Ux4Zq7Pw0Mt3Jv6Ys9Br2El5Oi8';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'm2Qp7Ls4Wv1Tz6Yc0Bj3Hw5Gr8Dx1Ua4Ze7Pn0Mt3Jy6Vs9Bg2Ek5Or8Xf1Uq4';

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

export const isServerSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_KEY &&
  SUPABASE_URL !== 'https://placeholder.supabase.co' &&
  SUPABASE_KEY !== 'placeholder' &&
  (SUPABASE_KEY.startsWith('sb_secret_') || SUPABASE_KEY.startsWith('eyJ') || SUPABASE_KEY.startsWith('sbp_') || SUPABASE_KEY.length > 20)
);

export const serverSupabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_KEY || 'placeholder',
  { auth: { persistSession: false } }
);

// Revoked token IDs / tokens (Session invalidation / Logout / Invalidate all)
const revokedTokens = new Set<string>();
const userRevocationTimestamp = new Map<string, number>();

// Common weak passwords to reject
const COMMON_PASSWORDS = new Set([
  '123456', '12345678', '123456789', 'password', '1234567890',
  'qwerty', 'admin', 'admin123', 'pass123', 'iloveyou', 'welcome'
]);

export function validateUsername(username: string): { valid: boolean; message?: string } {
  if (!username) return { valid: false, message: 'نام کاربری الزامی است.' };
  const clean = username.trim();
  if (clean.length < 3 || clean.length > 30) {
    return { valid: false, message: 'نام کاربری باید بین ۳ تا ۳۰ کاراکتر باشد.' };
  }
  // Allow letters, digits, and underscores
  if (!/^[a-zA-Z0-9_\u0600-\u06FF]+$/.test(clean)) {
    return { valid: false, message: 'نام کاربری فقط می‌تواند شامل حروف، اعداد و خط تیره زیرین باشد.' };
  }
  return { valid: true };
}

export function validateRole(role: string, level: number): { valid: boolean; message?: string } {
  const allowedRoles = [
    'super_admin', 'school_manager', 'education_manager', 'education_officer',
    'grade_mentor', 'research_manager', 'finance_manager', 'financial_officer',
    'class_representative', 'student'
  ];
  if (!allowedRoles.includes(role)) {
    return { valid: false, message: 'نقش کاربری انتخاب‌شده معتبر نیست.' };
  }
  if (![1, 2, 3].includes(Number(level))) {
    return { valid: false, message: 'سطح دسترسی باید ۱، ۲ یا ۳ باشد.' };
  }
  return { valid: true };
}

// User Idle Timeout tracking (30 minutes)
const userLastActivity = new Map<string, number>();
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 mins

export function updateLastActivity(userId: string) {
  if (userId) {
    userLastActivity.set(userId, Date.now());
  }
}

export function checkIdleTimeout(userId: string): boolean {
  if (!userId) return true;
  const lastActive = userLastActivity.get(userId);
  if (!lastActive) {
    userLastActivity.set(userId, Date.now());
    return true;
  }
  if (Date.now() - lastActive > IDLE_TIMEOUT_MS) {
    userLastActivity.delete(userId);
    return false; // Idle timed out
  }
  userLastActivity.set(userId, Date.now());
  return true;
}

// Timing attack mitigation: Pre-computed dummy hash to compare when user does not exist
const DUMMY_HASH = "$2a$10$7EqJtq98hPqEX7fNZaFWoOimwYV351i9tC8O.008u.a4xYqC7z0mG";

export async function dummyPasswordCheck(password: string) {
  try {
    await bcrypt.compare(password || 'dummy', DUMMY_HASH);
  } catch (e) {}
}

// Endpoint-specific rate limiting
interface EndpointLimitTracker {
  count: number;
  resetAt: number;
}
const endpointLimits = new Map<string, EndpointLimitTracker>();

export function checkEndpointRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let tracker = endpointLimits.get(key);
  if (!tracker || now > tracker.resetAt) {
    tracker = { count: 1, resetAt: now + windowMs };
    endpointLimits.set(key, tracker);
    return { allowed: true, remaining: maxRequests - 1 };
  }
  tracker.count += 1;
  if (tracker.count > maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: maxRequests - tracker.count };
}

// Security Alerting Engine
interface SecurityIncidentCounter {
  failedLogins: { count: number; windowStart: number };
  forbiddenRequests: { count: number; windowStart: number };
}
const incidentCounters = new Map<string, SecurityIncidentCounter>();

export function triggerSecurityAlert(type: string, details: Record<string, any>) {
  const now = Date.now();
  const alertPayload = {
    severity: 'HIGH',
    type,
    timestamp: new Date().toISOString(),
    details
  };
  console.warn(`[🚨 SECURITY ALERT] ${type}:`, JSON.stringify(alertPayload));
  // Record alert into audit log collection
  logServerAudit({
    userId: details.userId || 'system',
    username: details.username || 'unknown',
    action: `ALERT_${type}`,
    entityType: 'security_alert',
    entityId: details.ip || 'system',
    description: `هشدار امنیتی: ${type} - ${JSON.stringify(details)}`,
    ipAddress: details.ip || '0.0.0.0'
  }).catch(() => {});
}

export function trackSecurityIncident(ip: string, userId: string | undefined, eventType: 'LOGIN_FAILED' | 'FORBIDDEN') {
  const now = Date.now();
  const key = ip || userId || 'unknown';
  let tracker = incidentCounters.get(key);
  if (!tracker) {
    tracker = {
      failedLogins: { count: 0, windowStart: now },
      forbiddenRequests: { count: 0, windowStart: now }
    };
    incidentCounters.set(key, tracker);
  }

  if (eventType === 'LOGIN_FAILED') {
    if (now - tracker.failedLogins.windowStart > 60 * 60 * 1000) {
      tracker.failedLogins = { count: 1, windowStart: now };
    } else {
      tracker.failedLogins.count += 1;
      if (tracker.failedLogins.count >= 10) {
        triggerSecurityAlert('EXCESSIVE_FAILED_LOGINS', { ip, count: tracker.failedLogins.count });
      }
    }
  }

  if (eventType === 'FORBIDDEN') {
    if (now - tracker.forbiddenRequests.windowStart > 10 * 60 * 1000) {
      tracker.forbiddenRequests = { count: 1, windowStart: now };
    } else {
      tracker.forbiddenRequests.count += 1;
      if (tracker.forbiddenRequests.count >= 5) {
        triggerSecurityAlert('EXCESSIVE_FORBIDDEN_ATTEMPTS', { ip, userId, count: tracker.forbiddenRequests.count });
      }
    }
  }
}
interface AttemptTracker {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}
const ipAttempts = new Map<string, AttemptTracker>();
const usernameAttempts = new Map<string, AttemptTracker>();

export function checkRateLimit(ip: string, username: string): { allowed: boolean; waitMinutes?: number } {
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1000; // 15 mins
  const MAX_IP_ATTEMPTS = 15; // 15 attempts per IP in window
  const MAX_USER_ATTEMPTS = 5; // 5 failed attempts per user locks for 15 mins

  // Check IP
  let ipTrack = ipAttempts.get(ip);
  if (!ipTrack || (now - ipTrack.firstAttempt > WINDOW_MS)) {
    ipTrack = { count: 0, firstAttempt: now };
    ipAttempts.set(ip, ipTrack);
  }

  if (ipTrack.lockedUntil && now < ipTrack.lockedUntil) {
    const waitMinutes = Math.ceil((ipTrack.lockedUntil - now) / 60000);
    return { allowed: false, waitMinutes };
  }

  // Check Username
  const cleanUser = username.trim().toUpperCase();
  let userTrack = usernameAttempts.get(cleanUser);
  if (!userTrack || (now - userTrack.firstAttempt > WINDOW_MS)) {
    userTrack = { count: 0, firstAttempt: now };
    usernameAttempts.set(cleanUser, userTrack);
  }

  if (userTrack.lockedUntil && now < userTrack.lockedUntil) {
    const waitMinutes = Math.ceil((userTrack.lockedUntil - now) / 60000);
    return { allowed: false, waitMinutes };
  }

  if (ipTrack.count >= MAX_IP_ATTEMPTS) {
    ipTrack.lockedUntil = now + WINDOW_MS;
    return { allowed: false, waitMinutes: 15 };
  }

  if (userTrack.count >= MAX_USER_ATTEMPTS) {
    userTrack.lockedUntil = now + WINDOW_MS;
    return { allowed: false, waitMinutes: 15 };
  }

  return { allowed: true };
}

export function recordFailedAttempt(ip: string, username: string) {
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1000;
  
  const ipTrack = ipAttempts.get(ip) || { count: 0, firstAttempt: now };
  ipTrack.count += 1;
  ipAttempts.set(ip, ipTrack);

  const cleanUser = username.trim().toUpperCase();
  const userTrack = usernameAttempts.get(cleanUser) || { count: 0, firstAttempt: now };
  userTrack.count += 1;
  if (userTrack.count >= 5) {
    userTrack.lockedUntil = now + WINDOW_MS;
  }
  usernameAttempts.set(cleanUser, userTrack);
}

export function resetFailedAttempts(ip: string, username: string) {
  ipAttempts.delete(ip);
  usernameAttempts.delete(username.trim().toUpperCase());
}

export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}

export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  if (!hash || !plainText) return false;
  // If database still contains a legacy plain-text password, support comparison and flag for migration
  if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$')) {
    return plainText === hash;
  }
  return bcrypt.compare(plainText, hash);
}

export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase().trim())) {
    return { valid: false, message: 'این رمز عبور بسیار رایج و ضعیف است. لطفاً رمز عبور قوی‌تری انتخاب کنید.' };
  }
  const hasLetter = /[a-zA-Z\u0600-\u06FF]/.test(password);
  const hasNumber = /[0-9\u06F0-\u06F9]/.test(password);
  if (!hasLetter || !hasNumber) {
    return { valid: false, message: 'رمز عبور باید شامل حداقل یک حرف و یک عدد باشد.' };
  }
  return { valid: true };
}

export function generateTokens(user: SafeUser): { token: string; refreshToken: string } {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    level: user.level,
    scope: user.scope,
    iat: now
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id, username: user.username, iat: now }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  return { token, refreshToken };
}

export function verifyAccessToken(token: string): { valid: boolean; decoded?: any; error?: string } {
  try {
    if (revokedTokens.has(token)) {
      return { valid: false, error: 'این نشست باطل شده است.' };
    }
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Check idle timeout (30 mins without activity)
    if (!checkIdleTimeout(decoded.userId)) {
      return { valid: false, error: 'نشست کاربری به دلیل عدم فعالیت منقضی شده است (Idle Timeout).' };
    }
    
    // Check if user sessions were revoked after this token was issued
    const revokedAt = userRevocationTimestamp.get(decoded.userId);
    if (revokedAt && decoded.iat && (decoded.iat * 1000 < revokedAt)) {
      return { valid: false, error: 'نشست‌های این حساب توسط کاربر یا مدیر باطل شده است.' };
    }

    return { valid: true, decoded };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'توکن نامعتبر است.' };
  }
}

export function verifyRefreshToken(refreshToken: string): { valid: boolean; decoded?: any; error?: string } {
  try {
    if (revokedTokens.has(refreshToken)) {
      return { valid: false, error: 'این ریفرش‌توکن باطل شده است.' };
    }
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    
    const revokedAt = userRevocationTimestamp.get(decoded.userId);
    if (revokedAt && decoded.iat && (decoded.iat * 1000 < revokedAt)) {
      return { valid: false, error: 'نشست این حساب باطل شده است.' };
    }

    return { valid: true, decoded };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'ریفرش‌توکن نامعتبر است.' };
  }
}

export function revokeToken(token: string) {
  if (token) {
    revokedTokens.add(token);
  }
}

export function revokeAllUserSessions(userId: string) {
  if (userId) {
    userRevocationTimestamp.set(userId, Date.now());
  }
}

export function sanitizeUser(user: StoredUser | any): SafeUser {
  const safe = { ...user };
  delete safe.password;
  delete safe.passwordHash;
  delete safe.failedLoginAttempts;
  delete safe.accountLockedUntil;
  return safe;
}

export const DEFAULT_SERVER_USERS: StoredUser[] = [
  {
    id: 'user_sadegh',
    username: 'SADEGH',
    password: '8411924',
    name: 'صادق (سوپر ادمین)',
    level: 1,
    role: 'super_admin',
    roleTitle: 'سوپر ادمین (مدیر کل سیستم)',
    scope: 'all',
    gradeLabel: 'کل سیستم',
    mentorId: 'shahpoori',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: true,
    canBackup: true,
    avatarBg: 'bg-indigo-700',
    allowedTabs: [
      'todos', 'workflow', 'academic-calendar', 'presence-hours', 'finance', 'students', 'active-students',
      'discussion', 'programs', 'classrooms', 'student-schedule', 'teachers-schedule', 'stats', 'research',
      'attendance', 'course-selection', 'comments', 'summary', 'teachers-bank', 'backup', 'user-management', 'user-credentials', 'audit-logs'
    ],
  },
  {
    id: 'user_rahnama',
    username: 'RAHNAMA',
    password: '8411924',
    name: 'استاد رهنما (مدیر مدرسه / معاون)',
    level: 1,
    role: 'school_manager',
    roleTitle: 'مدیر مدرسه / معاون',
    scope: 'all',
    gradeLabel: 'کل سیستم (مشاهده)',
    mentorId: 'shahpoori',
    isReadOnly: true,
    canEdit: false,
    canManageUsers: false,
    canBackup: true,
    avatarBg: 'bg-slate-700',
    allowedTabs: [
      'todos', 'workflow', 'academic-calendar', 'presence-hours', 'finance', 'students', 'active-students',
      'discussion', 'programs', 'classrooms', 'student-schedule', 'teachers-schedule', 'stats', 'research',
      'attendance', 'course-selection', 'comments', 'summary', 'teachers-bank', 'backup', 'user-credentials', 'audit-logs'
    ],
  },
  {
    id: 'user_shah',
    username: 'SHAH',
    password: '8411924',
    name: 'استاد شاهپوری (مسئول آموزش)',
    level: 2,
    role: 'education_manager',
    roleTitle: 'مسئول آموزش',
    scope: 'all',
    gradeLabel: 'کل پایه‌ها',
    mentorId: 'shahpoori',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: true,
    avatarBg: 'bg-amber-600',
    allowedTabs: [
      'todos', 'workflow', 'academic-calendar', 'students', 'active-students', 'programs', 'classrooms',
      'student-schedule', 'teachers-schedule', 'consultation-advisor', 'counseling-classes', 'discussion', 'stats', 'attendance', 'course-selection', 'comments',
      'summary', 'teachers-bank', 'backup', 'user-credentials', 'audit-logs'
    ],
  },
  {
    id: 'user_isj',
    username: 'ISJ',
    password: '8411924',
    name: 'استاد حیاتی (مسئول پایه ۷)',
    level: 2,
    role: 'grade_mentor',
    roleTitle: 'مسئول پایه ۷',
    scope: 'grade_7',
    gradeLabel: 'پایه ۷',
    mentorId: 'hayati',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-emerald-600',
    allowedTabs: [
      'todos', 'workflow', 'academic-calendar', 'students', 'active-students', 'programs', 'classrooms',
      'student-schedule', 'teachers-schedule', 'consultation-advisor', 'counseling-classes', 'discussion', 'stats', 'attendance', 'comments',
      'summary', 'teachers-bank', 'user-credentials'
    ],
  },
  {
    id: 'user_ho',
    username: 'HO',
    password: '8411924',
    name: 'استاد حسینی (مسئول پایه ۸)',
    level: 2,
    role: 'grade_mentor',
    roleTitle: 'مسئول پایه ۸',
    scope: 'grade_8',
    gradeLabel: 'پایه ۸',
    mentorId: 'hosseini',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-sky-600',
    allowedTabs: [
      'todos', 'workflow', 'academic-calendar', 'students', 'active-students', 'programs', 'classrooms',
      'student-schedule', 'teachers-schedule', 'consultation-advisor', 'counseling-classes', 'discussion', 'stats', 'attendance', 'comments',
      'summary', 'teachers-bank', 'user-credentials'
    ],
  },
  {
    id: 'user_sol',
    username: 'SOL',
    password: '8411924',
    name: 'استاد سلیمانی (مسئول پایه ۹)',
    level: 2,
    role: 'grade_mentor',
    roleTitle: 'مسئول پایه ۹',
    scope: 'grade_9',
    gradeLabel: 'پایه ۹',
    mentorId: 'soleimani',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-purple-600',
    allowedTabs: [
      'todos', 'workflow', 'academic-calendar', 'students', 'active-students', 'programs', 'classrooms',
      'student-schedule', 'teachers-schedule', 'consultation-advisor', 'counseling-classes', 'discussion', 'stats', 'attendance', 'comments',
      'summary', 'teachers-bank', 'user-credentials'
    ],
  },
  {
    id: 'user_asadi',
    username: 'ASADI',
    password: '8411924',
    name: 'استاد اسدی (مسئول پایه ۱۰)',
    level: 2,
    role: 'grade_mentor',
    roleTitle: 'مسئول پایه ۱۰',
    scope: 'grade_10',
    gradeLabel: 'پایه ۱۰',
    mentorId: 'asadi',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-rose-600',
    allowedTabs: [
      'todos', 'workflow', 'academic-calendar', 'students', 'active-students', 'programs', 'classrooms',
      'student-schedule', 'teachers-schedule', 'consultation-advisor', 'counseling-classes', 'discussion', 'stats', 'attendance', 'comments',
      'summary', 'teachers-bank', 'user-credentials'
    ],
  },
  {
    id: 'user_yazdani',
    username: 'YAZDANI',
    password: '8411924',
    name: 'استاد یزدانی (مسئول پژوهش)',
    level: 2,
    role: 'research_manager',
    roleTitle: 'مسئول پژوهش',
    scope: 'all',
    gradeLabel: 'بخش پژوهش',
    mentorId: 'shahpoori',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-teal-600',
    allowedTabs: [
      'active-students', 'research', 'article-evaluations', 'counseling-classes', 'todos', 'workflow', 'programs', 'classrooms', 'teachers-schedule', 'user-credentials'
    ],
  },
  {
    id: 'user_mali',
    username: 'MALI',
    password: '8411924',
    name: 'مسئول مالی و اداری',
    level: 2,
    role: 'finance_manager',
    roleTitle: 'مسئول مالی و کارکرد',
    scope: 'all',
    gradeLabel: 'امور مالی',
    mentorId: 'shahpoori',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-cyan-700',
    allowedTabs: [
      'finance-tuition',
      'finance-grade-mentors',
      'finance-teachers',
      'finance-lunch',
      'finance-loans-fund',
      'finance-expenses-reports',
      'workflow',
      'todos',
      'academic-calendar',
      'students',
      'teachers-bank',
      'finance',
      'user-credentials'
    ],
  },
  {
    id: 'user_sarlak',
    username: 'SARLAK',
    password: '8411924',
    name: 'طلبه سرلک (نماینده کلاس)',
    level: 3,
    role: 'class_representative',
    roleTitle: 'نماینده کلاس',
    scope: 'class',
    gradeLabel: 'نماینده پایه',
    studentName: 'محمد سرلک',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-blue-600',
    allowedTabs: [
      'student-meals', 'attendance', 'student-schedule', 'programs', 'classrooms', 'discussion', 'stats', 'article-evaluations'
    ],
  },
  {
    id: 'user_jalili',
    username: 'JALILI',
    password: '8411924',
    name: 'طلبه جلیلی',
    level: 3,
    role: 'student',
    roleTitle: 'طلبه',
    scope: 'self',
    gradeLabel: 'طلبه پایه',
    studentName: 'علیرضا جلیلی',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-emerald-700',
    allowedTabs: [
      'student-meals', 'attendance', 'student-schedule', 'programs', 'classrooms', 'discussion', 'stats', 'comments', 'article-evaluations'
    ],
  },
];

// In-memory user store on server for fast fallback & dev environment
const serverMemoryUsers = new Map<string, StoredUser>();
DEFAULT_SERVER_USERS.forEach(u => serverMemoryUsers.set(u.username.toUpperCase(), { ...u }));

// =================== Server-Side User Storage and Migration ===================

export async function fetchAllUsersFromStorage(): Promise<StoredUser[]> {
  const usersMap = new Map<string, StoredUser>();
  DEFAULT_SERVER_USERS.forEach(u => usersMap.set(u.username.toUpperCase(), { ...u }));
  serverMemoryUsers.forEach((u, uname) => usersMap.set(uname, { ...u }));

  if (!isServerSupabaseConfigured) {
    return Array.from(usersMap.values());
  }
  try {
    // 1. Try reading from dedicated system_users table first
    const { data: dedicatedData, error: dedicatedError } = await serverSupabase
      .from('system_users')
      .select('*');

    if (!dedicatedError && dedicatedData && dedicatedData.length > 0) {
      dedicatedData.forEach(row => {
        const cleanName = (row.username || '').toUpperCase();
        if (cleanName) {
          usersMap.set(cleanName, {
            id: row.id || cleanName,
            username: cleanName,
            name: row.name || cleanName,
            role: row.role || 'student',
            level: row.level || 3,
            roleTitle: row.role_title,
            allowedTabs: Array.isArray(row.allowed_tabs) ? row.allowed_tabs : (usersMap.get(cleanName)?.allowedTabs || []),
            passwordHash: row.password_hash || usersMap.get(cleanName)?.passwordHash,
            password: row.password || usersMap.get(cleanName)?.password,
            mustChangePassword: !!row.must_change_password,
            failedLoginAttempts: row.failed_login_attempts || 0,
            accountLockedUntil: row.account_locked_until,
            lastLogin: row.last_login,
            ...(row.data || {})
          });
        }
      });
      return Array.from(usersMap.values());
    }

    // 2. Fallback to app_collections (system_users)
    const { data, error } = await serverSupabase
      .from('app_collections')
      .select('id, data')
      .eq('collection_name', 'system_users');

    if (error) {
      if (!error.message?.includes('Invalid API key')) {
        console.warn('Backend notice fetching users from Supabase:', error.message);
      }
      return Array.from(usersMap.values());
    }

    if (!data || data.length === 0) {
      return Array.from(usersMap.values());
    }

    const allUsersRow = data.find(r => r.id === 'all_users');
    if (allUsersRow && Array.isArray(allUsersRow.data?.users)) {
      allUsersRow.data.users.forEach((u: StoredUser) => {
        if (u && u.username) {
          usersMap.set(u.username.toUpperCase(), { ...usersMap.get(u.username.toUpperCase()), ...u });
        }
      });
    }

    // Merge individual user documents
    for (const row of data) {
      if (row.id !== 'all_users' && row.data) {
        const u = row.data as StoredUser;
        if (u && u.username) {
          const uname = u.username.toUpperCase();
          usersMap.set(uname, { ...usersMap.get(uname), ...u });
        }
      }
    }

    return Array.from(usersMap.values());
  } catch (e: any) {
    console.error('Error fetching users from storage:', e);
    return Array.from(usersMap.values());
  }
}

export async function saveUserToStorage(user: StoredUser): Promise<void> {
  const cleanId = (user.username || '').trim().toUpperCase();
  if (cleanId) {
    serverMemoryUsers.set(cleanId, { ...user, username: cleanId });
  }

  if (!isServerSupabaseConfigured) {
    return;
  }
  try {
    
    // Save to dedicated system_users table if it exists
    try {
      await serverSupabase.from('system_users').upsert({
        id: user.id || cleanId,
        username: cleanId,
        password_hash: user.passwordHash || '',
        name: user.name || '',
        role: user.role || 'student',
        level: user.level || 3,
        role_title: user.roleTitle || '',
        allowed_tabs: user.allowedTabs || [],
        must_change_password: !!user.mustChangePassword,
        failed_login_attempts: user.failedLoginAttempts || 0,
        account_locked_until: user.accountLockedUntil || null,
        last_login: user.lastLogin || null,
        data: user,
        updated_at: new Date().toISOString()
      }, { onConflict: 'username' });
    } catch {
      // Table might not exist yet if script not run yet
    }

    // Save individual record in app_collections
    await serverSupabase.from('app_collections').upsert({
      collection_name: 'system_users',
      id: cleanId,
      data: user,
      updated_at: new Date().toISOString()
    }, { onConflict: 'collection_name,id' });

    // Also update all_users batch list
    const currentList = await fetchAllUsersFromStorage();
    const idx = currentList.findIndex(u => u.username.toUpperCase() === cleanId);
    if (idx >= 0) {
      currentList[idx] = user;
    } else {
      currentList.push(user);
    }

    await serverSupabase.from('app_collections').upsert({
      collection_name: 'system_users',
      id: 'all_users',
      data: { users: currentList },
      updated_at: new Date().toISOString()
    }, { onConflict: 'collection_name,id' });

  } catch (e: any) {
    console.error('Error saving user to storage:', e);
  }
}

export async function migrateAllPlainPasswords(): Promise<{ totalUsers: number; migratedCount: number }> {
  const users = await fetchAllUsersFromStorage();
  let migratedCount = 0;

  for (const user of users) {
    let modified = false;

    // Check if password exists in plain text or passwordHash needs upgrade
    const plain = user.password;
    const currentHash = user.passwordHash;

    if (plain && (!currentHash || (!currentHash.startsWith('$2a$') && !currentHash.startsWith('$2b$')))) {
      user.passwordHash = await hashPassword(plain);
      delete user.password; // Remove plain text completely!
      modified = true;
      migratedCount += 1;
    } else if (currentHash && !currentHash.startsWith('$2a$') && !currentHash.startsWith('$2b$')) {
      user.passwordHash = await hashPassword(currentHash);
      delete user.password;
      modified = true;
      migratedCount += 1;
    } else if (user.password) {
      delete user.password;
      modified = true;
    }

    if (modified) {
      await saveUserToStorage(user);
    }
  }

  return { totalUsers: users.length, migratedCount };
}

// Server-side audit logging
export async function logServerAudit(params: {
  userId?: string;
  username?: string;
  userRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  ipAddress?: string;
  previousState?: any;
  newState?: any;
}) {
  try {
    const logEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      user_id: params.userId || 'system',
      username: params.username || 'system',
      user_role: params.userRole || 'system',
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      description: params.description,
      ip_address: params.ipAddress || '',
      previous_state: params.previousState || null,
      new_state: params.newState || null,
      created_at: new Date().toISOString()
    };

    // Store in app_collections audit_logs if configured
    if (isServerSupabaseConfigured) {
      await serverSupabase.from('app_collections').upsert({
        collection_name: 'audit_logs',
        id: logEntry.id,
        data: logEntry,
        updated_at: new Date().toISOString()
      });
    }
  } catch (e: any) {
    console.error('Server audit log error:', e?.message || e);
  }
}
