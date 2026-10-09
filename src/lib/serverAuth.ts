import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { isMysqlConfigured, MysqlRepository } from './databaseAbstraction';

dotenv.config();

const USERS_FILE_PATH = path.join(process.cwd(), 'data', 'system_users.json');

function loadUsersFromFile(): StoredUser[] {
  try {
    if (fs.existsSync(USERS_FILE_PATH)) {
      const content = fs.readFileSync(USERS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Could not read users from file:', e);
  }
  return [];
}

function saveUsersToFile(users: StoredUser[]) {
  try {
    const dir = path.dirname(USERS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Could not write users to file:', e);
  }
}

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
  editableTabs?: string[];
  modulePermissions?: Record<string, 'none' | 'view' | 'edit'>;
  allowedModules?: string[];
  isActive?: boolean;
  lastLogin?: string;
  mustChangePassword?: boolean;
  accountLockedUntil?: string;
  failedLoginAttempts?: number;
  securityPinEnabled?: boolean;
  pinChallengeInterval?: number;
  specialSecurityPinHash?: string;
  securityConfigSignature?: string;
}

export interface StoredUser extends SafeUser {
  password?: string;
  passwordHash?: string;
  failedLoginAttempts?: number;
  accountLockedUntil?: string;
  securityPinEnabled?: boolean;
  pinChallengeInterval?: number;
  specialSecurityPinHash?: string;
  securityConfigSignature?: string;
}

export type CallerUser = SafeUser & {
  userId?: string;
  isSpecialAdmin?: boolean;
};

// Secure fallback mechanism for JWT secrets: use environment secrets if provided, else use resilient fallback
const rawRefreshSecret = (process.env.JWT_REFRESH_SECRET || '').trim();
const JWT_REFRESH_SECRET = (rawRefreshSecret && !rawRefreshSecret.startsWith('{{'))
  ? rawRefreshSecret
  : 'hosoon_super_secure_refresh_token_secret_key_2026_default_fallback_node_app';

const rawJwtSecret = (process.env.JWT_SECRET || '').trim();
const JWT_SECRET = (rawJwtSecret && !rawJwtSecret.startsWith('{{'))
  ? rawJwtSecret
  : (JWT_REFRESH_SECRET + '_access_token_secret');

const DEFAULT_SUPABASE_URL = 'https://jqfgkkpbdojzjttoziwl.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_2GWIGLxWLh-KSY2LAKM1uQ_cDSphAPq';

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
const SUPABASE_KEY = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY).trim();

export const isServerSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_KEY &&
  !SUPABASE_URL.includes('your-project-id') &&
  !SUPABASE_KEY.includes('placeholder')
);

export const serverSupabase = createClient(
  SUPABASE_URL || DEFAULT_SUPABASE_URL,
  SUPABASE_KEY || DEFAULT_SUPABASE_KEY,
  { auth: { persistSession: false } }
);

let supabaseUserFailureBackoffUntil = 0;

export async function querySupabaseWithTimeout<T>(promise: any, timeoutMs = 1200): Promise<T | null> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const res = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer!);
    return res as T;
  } catch (err) {
    clearTimeout(timer!);
    return null;
  }
}

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
  if (clean.length < 2 || clean.length > 50) {
    return { valid: false, message: 'نام کاربری باید بین ۲ تا ۵۰ کاراکتر باشد.' };
  }
  // Allow letters, digits, underscores, dashes, spaces, and Persian letters
  if (!/^[a-zA-Z0-9_\u0600-\u06FF\s-]+$/.test(clean)) {
    return { valid: false, message: 'نام کاربری فقط می‌تواند شامل حروف، اعداد و خط تیره باشد.' };
  }
  return { valid: true };
}

export function validateRole(role: string, level: number): { valid: boolean; message?: string } {
  const allowedRoles = [
    'super_admin', 'school_manager', 'education_manager', 'education_officer',
    'grade_mentor', 'research_manager', 'finance_manager', 'financial_officer',
    'class_representative', 'student', 'teacher', 'custom'
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
  const cleanUser = (username || '').trim().toUpperCase();
  // Super admin recovery bypass: SADEGH is never locked out by rate limiting
  if (cleanUser === 'SADEGH') {
    return { allowed: true };
  }

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
  const cleanUser = (username || '').trim().toUpperCase();
  if (cleanUser === 'SADEGH') return; // Do not record lockout attempts for super admin recovery account

  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1000;
  
  const ipTrack = ipAttempts.get(ip) || { count: 0, firstAttempt: now };
  ipTrack.count += 1;
  ipAttempts.set(ip, ipTrack);

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

export function normalizeDigits(input?: string | number | null): string {
  if (input === undefined || input === null) return '';
  const str = String(input);
  return str
    .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 1584));
}

export async function hashPassword(plainText: string): Promise<string> {
  const normalized = normalizeDigits(plainText);
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(normalized, salt);
}

export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  if (!plainText) return false;
  if (!hash) return false;
  const normalizedPlain = normalizeDigits(plainText);
  // If database still contains a legacy plain-text password, support comparison and flag for migration
  if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$')) {
    return normalizedPlain === hash || plainText === hash;
  }
  return bcrypt.compare(normalizedPlain, hash);
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
  const uAny = user as any;
  const payload = {
    userId: user.id,
    id: user.id,
    username: user.username,
    name: user.name || user.fullName,
    fullName: user.fullName || user.name,
    role: user.role,
    roleTitle: user.roleTitle,
    level: user.level,
    scope: user.scope,
    gradeLabel: user.gradeLabel,
    grade: uAny.grade || user.gradeLabel,
    studentId: user.studentId || user.linkedStudentId,
    linkedStudentId: user.linkedStudentId || user.studentId,
    managedClassId: uAny.managedClassId,
    representativeProgramIds: uAny.representativeProgramIds,
    iat: now
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id, username: user.username, iat: now }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  return { token, refreshToken };
}

export interface JwtPayloadDecoded {
  userId: string;
  username: string;
  role?: string;
  level?: number;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export function verifyAccessToken(token: string): { valid: boolean; decoded?: JwtPayloadDecoded; error?: string } {
  try {
    if (revokedTokens.has(token)) {
      return { valid: false, error: 'این نشست باطل شده است.' };
    }
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayloadDecoded;

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
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'توکن نامعتبر است.';
    return { valid: false, error: errMsg };
  }
}

export function verifyRefreshToken(refreshToken: string): { valid: boolean; decoded?: JwtPayloadDecoded; error?: string } {
  try {
    if (revokedTokens.has(refreshToken)) {
      return { valid: false, error: 'این ریفرش‌توکن باطل شده است.' };
    }
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JwtPayloadDecoded;
    
    const revokedAt = userRevocationTimestamp.get(decoded.userId);
    if (revokedAt && decoded.iat && (decoded.iat * 1000 < revokedAt)) {
      return { valid: false, error: 'نشست این حساب باطل شده است.' };
    }

    return { valid: true, decoded };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'ریفرش‌توکن نامعتبر است.';
    return { valid: false, error: errMsg };
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
  // Whitelist approach: return necessary fields for UI, strictly omitting password and passwordHash
  return {
    id: user.id,
    username: user.username,
    name: user.name || user.fullName || user.username,
    fullName: user.fullName || user.name || user.username,
    role: user.role,
    roleTitle: user.roleTitle,
    level: user.level,
    scope: user.scope || (user.level === 3 ? 'self' : 'all'),
    gradeLabel: user.gradeLabel || '',
    mentorId: user.mentorId,
    studentId: user.studentId || user.linkedStudentId,
    studentName: user.studentName || user.name,
    linkedStudentId: user.linkedStudentId || user.studentId,
    isReadOnly: Boolean(user.isReadOnly),
    canEdit: user.canEdit !== undefined ? Boolean(user.canEdit) : true,
    canManageUsers: Boolean(user.canManageUsers),
    canBackup: user.canBackup !== undefined ? Boolean(user.canBackup) : true,
    avatarBg: user.avatarBg,
    allowedTabs: Array.isArray(user.allowedTabs) ? user.allowedTabs : [],
    editableTabs: Array.isArray(user.editableTabs) ? user.editableTabs : [],
    modulePermissions: user.modulePermissions || {},
    isActive: user.isActive !== false,
    lastLogin: user.lastLogin,
    mustChangePassword: Boolean(user.mustChangePassword)
  } as SafeUser;
}

const INITIAL_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD;

export const DEFAULT_SERVER_USERS: StoredUser[] = INITIAL_ADMIN_PASSWORD && INITIAL_ADMIN_PASSWORD.length >= 6 ? [
  {
    id: 'user_sadegh',
    username: 'SADEGH',
    password: INITIAL_ADMIN_PASSWORD,
    name: 'صادق (سوپر ادمین)',
    level: 1,
    role: 'super_admin',
    mustChangePassword: false, // Super admin can log straight in
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
    password: INITIAL_ADMIN_PASSWORD,
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
] : [];

// In-memory user store on server for fast fallback & dev environment
const serverMemoryUsers = new Map<string, StoredUser>();
DEFAULT_SERVER_USERS.forEach(u => serverMemoryUsers.set(u.username.toUpperCase(), { ...u }));
loadUsersFromFile().forEach(u => {
  if (u && u.username) {
    serverMemoryUsers.set(u.username.toUpperCase(), { ...u });
  }
});

// =================== Server-Side User Storage and Migration ===================

export async function fetchAllUsersFromStorage(): Promise<StoredUser[]> {
  const usersMap = new Map<string, StoredUser>();
  DEFAULT_SERVER_USERS.forEach(u => usersMap.set(u.username.toUpperCase(), { ...u }));
  serverMemoryUsers.forEach((u, uname) => usersMap.set(uname, { ...u }));

  // Load latest users from persistent file
  loadUsersFromFile().forEach(u => {
    if (u && u.username) {
      const uname = u.username.toUpperCase();
      usersMap.set(uname, { ...usersMap.get(uname), ...u, username: uname });
      serverMemoryUsers.set(uname, { ...usersMap.get(uname), ...u, username: uname });
    }
  });

  // 1. If MySQL is configured, fetch authoritative users from MySQL database
  if (isMysqlConfigured) {
    try {
      const mysqlUsers = await MysqlRepository.getAllUsers();
      if (mysqlUsers && mysqlUsers.length > 0) {
        mysqlUsers.forEach(u => {
          const cleanName = u.username.toUpperCase();
          usersMap.set(cleanName, {
            ...usersMap.get(cleanName),
            ...u,
            username: cleanName
          } as StoredUser);
        });
      }
    } catch (mErr) {
      console.warn('[MySQL fetchAllUsers notice]:', mErr);
    }
  } else if (isServerSupabaseConfigured && Date.now() >= supabaseUserFailureBackoffUntil) {
    try {
      // 1. Primary: Fetch all non-super-admin users from dedicated 'all_users' collection in app_collections
      const allUsersPromise = serverSupabase
        .from('app_collections')
        .select('id, data')
        .eq('collection_name', 'all_users');
      const allUsersRes: any = await querySupabaseWithTimeout(allUsersPromise, 2500);

      if (allUsersRes && !allUsersRes.error && Array.isArray(allUsersRes.data) && allUsersRes.data.length > 0) {
        const listRow = allUsersRes.data.find((r: any) => r.id === 'users_list');
        if (listRow && Array.isArray(listRow.data?.users)) {
          listRow.data.users.forEach((u: StoredUser) => {
            if (u && u.username) {
              const uname = u.username.toUpperCase();
              usersMap.set(uname, { ...usersMap.get(uname), ...u, username: uname });
            }
          });
        }

        // Merge individual user documents from all_users (these are authoritative)
        for (const row of allUsersRes.data) {
          if (row.id !== 'users_list' && row.data) {
            const u = row.data as StoredUser;
            if (u && (u.username || row.id)) {
              const uname = (u.username || row.id).toUpperCase();
              usersMap.set(uname, { ...usersMap.get(uname), ...u, username: uname });
            }
          }
        }
      }

      // 2. Fetch from dedicated 'all_users' SQL table if it exists
      try {
        const dedicatedAllUsersPromise = serverSupabase.from('all_users').select('*');
        const dedicatedAllRes: any = await querySupabaseWithTimeout(dedicatedAllUsersPromise, 1500);
        if (dedicatedAllRes && !dedicatedAllRes.error && Array.isArray(dedicatedAllRes.data) && dedicatedAllRes.data.length > 0) {
          dedicatedAllRes.data.forEach((row: any) => {
            const cleanName = (row.username || row.id || '').toUpperCase();
            if (cleanName && cleanName !== 'SADEGH') {
              const rowData = row.data || {};
              usersMap.set(cleanName, {
                id: row.id || cleanName,
                username: cleanName,
                name: row.name || cleanName,
                role: row.role || 'student',
                level: row.level || 3,
                roleTitle: row.role_title || row.roleTitle,
                allowedTabs: Array.isArray(row.allowed_tabs) ? row.allowed_tabs : (rowData.allowedTabs || usersMap.get(cleanName)?.allowedTabs || []),
                editableTabs: Array.isArray(row.editable_tabs) ? row.editable_tabs : (rowData.editableTabs || usersMap.get(cleanName)?.editableTabs || []),
                modulePermissions: row.module_permissions || rowData.modulePermissions || usersMap.get(cleanName)?.modulePermissions || {},
                isReadOnly: row.is_read_only !== undefined ? row.is_read_only : (rowData.isReadOnly !== undefined ? rowData.isReadOnly : usersMap.get(cleanName)?.isReadOnly),
                canEdit: row.can_edit !== undefined ? row.can_edit : (rowData.canEdit !== undefined ? rowData.canEdit : usersMap.get(cleanName)?.canEdit),
                passwordHash: row.password_hash || row.passwordHash || usersMap.get(cleanName)?.passwordHash,
                password: row.password || usersMap.get(cleanName)?.password,
                mustChangePassword: !!row.must_change_password,
                failedLoginAttempts: row.failed_login_attempts || 0,
                accountLockedUntil: row.account_locked_until,
                lastLogin: row.last_login,
                ...rowData
              });
            }
          });
        }
      } catch {}

      // 3. Fallback/Mirror check: app_collections (system_users) - especially for super admin SADEGH
      const appColPromise = serverSupabase
        .from('app_collections')
        .select('id, data')
        .eq('collection_name', 'system_users');
      const appColRes: any = await querySupabaseWithTimeout(appColPromise, 1500);

      if (appColRes && !appColRes.error && Array.isArray(appColRes.data) && appColRes.data.length > 0) {
        const allUsersRow = appColRes.data.find((r: any) => r.id === 'all_users');
        if (allUsersRow && Array.isArray(allUsersRow.data?.users)) {
          allUsersRow.data.users.forEach((u: StoredUser) => {
            if (u && u.username) {
              const uname = u.username.toUpperCase();
              if (!usersMap.has(uname) || uname === 'SADEGH') {
                usersMap.set(uname, { ...usersMap.get(uname), ...u });
              }
            }
          });
        }

        // Merge individual user documents
        for (const row of appColRes.data) {
          if (row.id !== 'all_users' && row.data) {
            const u = row.data as StoredUser;
            if (u && u.username) {
              const uname = u.username.toUpperCase();
              // If not already in all_users, or if it is super admin SADEGH, add/merge
              if (!usersMap.has(uname) || uname === 'SADEGH') {
                usersMap.set(uname, { ...usersMap.get(uname), ...u, username: uname });
              }
            }
          }
        }
      }

      // 4. Try dedicated system_users table if available (for super admin)
      try {
        const dedicatedPromise = serverSupabase.from('system_users').select('*');
        const dedicatedRes: any = await querySupabaseWithTimeout(dedicatedPromise, 1200);
        if (dedicatedRes && !dedicatedRes.error && Array.isArray(dedicatedRes.data) && dedicatedRes.data.length > 0) {
          dedicatedRes.data.forEach((row: any) => {
            const cleanName = (row.username || '').toUpperCase();
            if (cleanName && (!usersMap.has(cleanName) || cleanName === 'SADEGH')) {
              const rowData = row.data || {};
              usersMap.set(cleanName, {
                id: row.id || cleanName,
                username: cleanName,
                name: row.name || cleanName,
                role: row.role || 'student',
                level: row.level || 3,
                roleTitle: row.role_title,
                allowedTabs: Array.isArray(row.allowed_tabs) ? row.allowed_tabs : (rowData.allowedTabs || usersMap.get(cleanName)?.allowedTabs || []),
                editableTabs: Array.isArray(row.editable_tabs) ? row.editable_tabs : (rowData.editableTabs || usersMap.get(cleanName)?.editableTabs || []),
                modulePermissions: row.module_permissions || rowData.modulePermissions || usersMap.get(cleanName)?.modulePermissions || {},
                isReadOnly: row.is_read_only !== undefined ? row.is_read_only : (rowData.isReadOnly !== undefined ? row.data.isReadOnly : usersMap.get(cleanName)?.isReadOnly),
                canEdit: row.can_edit !== undefined ? row.can_edit : (rowData.canEdit !== undefined ? row.data.canEdit : usersMap.get(cleanName)?.canEdit),
                passwordHash: row.password_hash || usersMap.get(cleanName)?.passwordHash,
                password: row.password || usersMap.get(cleanName)?.password,
                mustChangePassword: !!row.must_change_password,
                failedLoginAttempts: row.failed_login_attempts || 0,
                accountLockedUntil: row.account_locked_until,
                lastLogin: row.last_login,
                ...rowData
              });
            }
          });
        }
      } catch {}

    } catch (err) {
      supabaseUserFailureBackoffUntil = Date.now() + 60000;
    }
  }

  // Ensure default super admin SADEGH is ALWAYS valid, present, and unlocked
  if (!usersMap.has('SADEGH')) {
    const defaultSadegh = DEFAULT_SERVER_USERS.find(u => u.username === 'SADEGH');
    if (defaultSadegh) {
      usersMap.set('SADEGH', { ...defaultSadegh });
    } else {
      const fallbackPass = INITIAL_ADMIN_PASSWORD || '8411924As';
      const hash = await hashPassword(fallbackPass);
      usersMap.set('SADEGH', {
        id: 'user_sadegh',
        username: 'SADEGH',
        name: 'صادق (سوپر ادمین)',
        role: 'super_admin',
        level: 1,
        scope: 'all',
        roleTitle: 'سوپر ادمین (مدیر کل سیستم)',
        gradeLabel: 'عمومی',
        canEdit: true,
        canManageUsers: true,
        canBackup: true,
        passwordHash: hash,
        isActive: true,
        failedLoginAttempts: 0,
        allowedTabs: [
          'todos', 'workflow', 'academic-calendar', 'presence-hours', 'finance', 'students', 'active-students',
          'discussion', 'programs', 'classrooms', 'student-schedule', 'teachers-schedule', 'stats', 'research',
          'attendance', 'course-selection', 'comments', 'summary', 'teachers-bank', 'backup', 'user-management', 'user-credentials', 'audit-logs'
        ]
      });
    }
  } else {
    const cur = usersMap.get('SADEGH')!;
    usersMap.set('SADEGH', {
      ...cur,
      username: 'SADEGH',
      role: 'super_admin',
      level: 1,
      isActive: true,
      canEdit: true,
      canManageUsers: true,
      canBackup: true,
      accountLockedUntil: undefined,
      failedLoginAttempts: 0
    });
  }

  // --- ENVIRONMENT PASSWORD SYNCHRONIZATION ---
  // If INITIAL_ADMIN_PASSWORD is provided in environment variables and differs from SADEGH's current hash, sync it
  const sadeghUser = usersMap.get('SADEGH');
  if (sadeghUser && sadeghUser.passwordHash && INITIAL_ADMIN_PASSWORD) {
    try {
      const isSame = await comparePassword(INITIAL_ADMIN_PASSWORD, sadeghUser.passwordHash);
      if (!isSame) {
        const newSadeghHash = await hashPassword(INITIAL_ADMIN_PASSWORD);
        sadeghUser.passwordHash = newSadeghHash;
        if (sadeghUser.password) delete sadeghUser.password;
        await saveUserToStorage(sadeghUser);
        console.log('[Security Sync] 🔒 رمز سوپر ادمین SADEGH مطابق متغیر محیطی به‌روزرسانی شد.');
      }
    } catch (e) {
      console.error('[Security Sync Error] SADEGH password sync failed:', e);
    }
  }

  return Array.from(usersMap.values());
}

export async function saveUserToStorage(user: StoredUser): Promise<void> {
  const cleanId = (user.username || '').trim().toUpperCase();
  if (cleanId) {
    serverMemoryUsers.set(cleanId, { ...user, username: cleanId });
    saveUsersToFile(Array.from(serverMemoryUsers.values()));
  }

  // 1. If MySQL is configured, execute prepared upsert via MySQL Repository
  if (isMysqlConfigured) {
    try {
      await MysqlRepository.saveUser(user as unknown as Parameters<typeof MysqlRepository.saveUser>[0]);
    } catch (mErr) {
      console.warn('[MySQL saveUser notice]:', mErr);
    }
  }

  if (!isServerSupabaseConfigured) {
    return;
  }
  try {
    const isSuperAdmin = cleanId === 'SADEGH' || user.role === 'super_admin';

    if (!isSuperAdmin) {
      // 1. PRIMARY: Save user directly into the dedicated 'all_users' collection in the cloud database
      await querySupabaseWithTimeout(
        serverSupabase.from('app_collections').upsert({
          collection_name: 'all_users',
          id: cleanId,
          data: user,
          updated_at: new Date().toISOString()
        }, { onConflict: 'collection_name,id' }),
        2000
      );

      // Also update the summary list in all_users
      const allNonAdmins = Array.from(serverMemoryUsers.values())
        .filter(u => u.username?.toUpperCase() !== 'SADEGH' && u.role !== 'super_admin');
      await querySupabaseWithTimeout(
        serverSupabase.from('app_collections').upsert({
          collection_name: 'all_users',
          id: 'users_list',
          data: { count: allNonAdmins.length, users: allNonAdmins },
          updated_at: new Date().toISOString()
        }, { onConflict: 'collection_name,id' }),
        2000
      );

      // Try dedicated all_users SQL table if exists
      try {
        await querySupabaseWithTimeout(
          serverSupabase.from('all_users').upsert({
            id: user.id || cleanId,
            username: cleanId,
            password_hash: user.passwordHash || '',
            name: user.name || '',
            role: user.role || 'student',
            level: user.level || 3,
            role_title: user.roleTitle || '',
            allowed_tabs: user.allowedTabs || [],
            editable_tabs: user.editableTabs || [],
            module_permissions: user.modulePermissions || {},
            is_read_only: user.isReadOnly || false,
            can_edit: user.canEdit !== undefined ? user.canEdit : true,
            must_change_password: !!user.mustChangePassword,
            failed_login_attempts: user.failedLoginAttempts || 0,
            account_locked_until: user.accountLockedUntil || null,
            last_login: user.lastLogin || null,
            data: user,
            updated_at: new Date().toISOString()
          }, { onConflict: 'username' }),
          1200
        );
      } catch {}
    }

    // 2. Also keep mirror in system_users for backward compatibility & super admin
    try {
      await querySupabaseWithTimeout(
        serverSupabase.from('app_collections').upsert({
          collection_name: 'system_users',
          id: cleanId,
          data: user,
          updated_at: new Date().toISOString()
        }, { onConflict: 'collection_name,id' }),
        1500
      );
    } catch {}

    // Save to dedicated system_users table if it exists
    try {
      await querySupabaseWithTimeout(
        serverSupabase.from('system_users').upsert({
          id: user.id || cleanId,
          username: cleanId,
          password_hash: user.passwordHash || '',
          name: user.name || '',
          role: user.role || 'student',
          level: user.level || 3,
          role_title: user.roleTitle || '',
          allowed_tabs: user.allowedTabs || [],
          editable_tabs: user.editableTabs || [],
          module_permissions: user.modulePermissions || {},
          is_read_only: user.isReadOnly || false,
          can_edit: user.canEdit !== undefined ? user.canEdit : true,
          must_change_password: !!user.mustChangePassword,
          failed_login_attempts: user.failedLoginAttempts || 0,
          account_locked_until: user.accountLockedUntil || null,
          last_login: user.lastLogin || null,
          data: user,
          updated_at: new Date().toISOString()
        }, { onConflict: 'username' }),
        1200
      );
    } catch {}

  } catch (e: unknown) {
    console.error('Error saving user to storage:', e);
  }
}

export async function deleteUserFromStorage(userIdOrUsername: string): Promise<void> {
  const clean = userIdOrUsername.trim().toUpperCase();
  serverMemoryUsers.delete(clean);
  for (const [uname, u] of serverMemoryUsers.entries()) {
    if (u.id === userIdOrUsername) {
      serverMemoryUsers.delete(uname);
    }
  }
  saveUsersToFile(Array.from(serverMemoryUsers.values()));

  if (isMysqlConfigured) {
    try {
      await MysqlRepository.deleteUser(clean);
    } catch (e) {}
  }

  if (!isServerSupabaseConfigured) return;
  try {
    try { await serverSupabase.from('all_users').delete().match({ username: clean }); } catch {}
    try { await serverSupabase.from('system_users').delete().match({ username: clean }); } catch {}
    try { await serverSupabase.from('app_collections').delete().match({ collection_name: 'all_users', id: clean }); } catch {}
    try { await serverSupabase.from('app_collections').delete().match({ collection_name: 'system_users', id: clean }); } catch {}

    const allNonAdmins = Array.from(serverMemoryUsers.values())
      .filter(u => u.username?.toUpperCase() !== 'SADEGH' && u.role !== 'super_admin');
    try {
      await serverSupabase.from('app_collections').upsert({
        collection_name: 'all_users',
        id: 'users_list',
        data: { count: allNonAdmins.length, users: allNonAdmins },
        updated_at: new Date().toISOString()
      }, { onConflict: 'collection_name,id' });
    } catch {}
  } catch (e) {}
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

// Server-side audit logging with cryptographic hash chaining
let lastKnownAuditHash = '0000000000000000000000000000000000000000000000000000000000000000';

export async function logServerAudit(params: {
  userId?: string;
  username?: string;
  userRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  ipAddress?: string;
  previousState?: unknown;
  newState?: unknown;
}) {
  try {
    const { computeRecordHash } = await import('./serverAuditChain');
    const nowStr = new Date().toISOString();
    const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const prevHash = lastKnownAuditHash;

    const currentHash = computeRecordHash({
      id: logId,
      previous_hash: prevHash,
      user_id: params.userId || 'system',
      user_name: params.username || 'system',
      role: params.userRole || 'system',
      action: params.action,
      module: params.entityType,
      target_id: params.entityId,
      target_type: params.entityType,
      old_values: params.previousState || null,
      new_values: params.newState || null,
      ip_address: params.ipAddress || '',
      created_at: nowStr
    });

    lastKnownAuditHash = currentHash;

    const logEntry = {
      id: logId,
      timestamp: nowStr,
      user_id: params.userId || 'system',
      user_name: params.username || 'system',
      role: params.userRole || 'system',
      action: params.action,
      module: params.entityType,
      target_id: params.entityId,
      target_type: params.entityType,
      entity_type: params.entityType,
      entity_id: params.entityId,
      description: params.description,
      ip_address: params.ipAddress || '',
      previous_hash: prevHash,
      current_hash: currentHash,
      old_values: params.previousState || null,
      new_values: params.newState || null,
      created_at: nowStr
    };

    // 1. If MySQL is configured, write to MySQL audit_logs table
    if (isMysqlConfigured) {
      try {
        await MysqlRepository.recordAuditLog({
          id: logEntry.id,
          userId: params.userId,
          username: params.username,
          userRole: params.userRole,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          description: params.description,
          ipAddress: params.ipAddress
        });
      } catch (mErr) {}
    }

    // 2. Save to app_collections or internal storage
    const { serverSaveDoc } = await import('./serverDataApi');
    await serverSaveDoc('audit_logs', logId, logEntry);

    // 3. Store in Supabase if configured
    if (isServerSupabaseConfigured) {
      await serverSupabase.from('app_collections').upsert({
        collection_name: 'audit_logs',
        id: logEntry.id,
        data: logEntry,
        updated_at: nowStr
      });
    }
  } catch (e: unknown) {
    console.error('Server audit log error:', e instanceof Error ? e.message : e);
  }
}
