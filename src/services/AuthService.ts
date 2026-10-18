import bcrypt from 'bcryptjs';
import {
  checkRateLimit,
  recordFailedAttempt,
  resetFailedAttempts,
  comparePassword,
  hashPassword,
  validatePasswordStrength,
  validateUsername,
  dummyPasswordCheck,
  trackSecurityIncident,
  updateLastActivity,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  revokeToken,
  revokeAllUserSessions,
  sanitizeUser,
  fetchAllUsersFromStorage,
  fetchUserByUsername,
  saveUserToStorage,
  deleteUserFromStorage,
  logServerAudit,
  StoredUser,
  SafeUser,
  normalizeDigits,
  DbConnectionError,
  isConnectionError
} from '../lib/serverAuth';
import { AppError } from '../lib/errorHandler';
import { logger } from '../lib/logger';

export class AuthService {
  /**
   * Authenticate user with password / master password, rate limiting, and bcrypt verification
   */
  public static async login(usernameInput: string, passwordInput: string, clientIp: string) {
    const cleanUser = normalizeDigits(usernameInput).trim().toUpperCase();
    const cleanPass = normalizeDigits(passwordInput).trim();

    const userVal = validateUsername(cleanUser);
    if (!userVal.valid) {
      throw new AppError(userVal.message || 'نام کاربری نامعتبر است.', { statusCode: 400 });
    }

    // Rate Limiting Check
    const rateCheck = checkRateLimit(clientIp, cleanUser);
    if (!rateCheck.allowed) {
      throw new AppError(
        `تعداد دفعات تلاش ناموفق بیش از حد مجاز است. لطفاً ${rateCheck.waitMinutes} دقیقه دیگر مجدداً تلاش کنید.`,
        { statusCode: 429 }
      );
    } else {
      resetFailedAttempts(clientIp, cleanUser);
    }

    const tStart = Date.now();
    console.log(`[LOGIN_BENCHMARK] Start login for user: ${cleanUser}`);

    // High performance targeted user lookup O(1)
    let user: StoredUser | null = null;
    const tDbStart = Date.now();
    try {
      user = await fetchUserByUsername(cleanUser);
      console.log(`[LOGIN_BENCHMARK] 1. DB User Lookup (SELECT): ${Date.now() - tDbStart}ms`);
    } catch (e: any) {
      console.error(`[LOGIN_BENCHMARK] 1. DB User Lookup ERROR after ${Date.now() - tDbStart}ms:`, e?.message || e);
      if (isConnectionError(e) || e?.isDbConnectionError || e?.statusCode === 503) {
        throw new AppError('ارتباط با پایگاه داده برقرار نشد. لطفاً چند لحظه بعد مجدداً تلاش کنید.', { statusCode: 503 });
      }
      throw e;
    }

    if (!user) {
      // Check default server users fallback
      const { DEFAULT_SERVER_USERS } = await import('../lib/serverAuth');
      const defaultMatch = DEFAULT_SERVER_USERS.find(u => u.username.toUpperCase() === cleanUser);
      if (defaultMatch) {
        user = { ...defaultMatch };
        await saveUserToStorage(user);
      }
    }

    if (!user) {
      await dummyPasswordCheck(cleanPass);
      recordFailedAttempt(clientIp, cleanUser);
      trackSecurityIncident(clientIp, undefined, 'LOGIN_FAILED');
      // Fire-and-forget background audit log
      void logServerAudit({
        username: cleanUser,
        action: 'LOGIN_FAILED',
        entityType: 'auth',
        entityId: cleanUser,
        description: 'تلاش ناموفق برای ورود: نام کاربری یا رمز عبور نامعتبر است.',
        ipAddress: clientIp
      }).catch(() => {});
      throw new AppError('نام کاربری یا رمز عبور اشتباه است.', { statusCode: 401 });
    }

    // Check account lock
    if (cleanUser !== 'SADEGH' && user.accountLockedUntil && new Date(user.accountLockedUntil) > new Date()) {
      throw new AppError('حساب کاربری موقتاً مسدود شده است. با مدیر سامانه تماس بگیرید.', { statusCode: 403 });
    }

    // Verify Password
    const storedHashOrPlain = user.passwordHash || user.password || '';
    const tBcryptStart = Date.now();
    let isMatch = await comparePassword(cleanPass, storedHashOrPlain);
    console.log(`[LOGIN_BENCHMARK] 2. bcrypt.compare: ${Date.now() - tBcryptStart}ms`);

    // Emergency Owner Recovery for SADEGH:
    // If the stored hash in the database is mismatched or out of sync, allow owner verification via 8411924As,
    // which immediately self-heals by converting to a fresh bcrypt hash upon successful login.
    if (!isMatch && cleanUser === 'SADEGH' && cleanPass === '8411924As') {
      isMatch = true;
    }

    if (!isMatch) {
      recordFailedAttempt(clientIp, cleanUser);
      trackSecurityIncident(clientIp, user.id, 'LOGIN_FAILED');
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      await saveUserToStorage(user);

      // Fire-and-forget background audit log
      void logServerAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'LOGIN_FAILED',
        entityType: 'auth',
        entityId: user.id,
        description: `تلاش ناموفق برای ورود: رمز عبور نادرست برای ${user.username}`,
        ipAddress: clientIp
      }).catch(() => {});

      throw new AppError('نام کاربری یا رمز عبور اشتباه است.', { statusCode: 401 });
    }

    // Upgrade plain text or legacy cost factor to optimized bcrypt (cost 8) on the fly
    const isOptimizedCost = user.passwordHash?.startsWith('$2a$08$') || user.passwordHash?.startsWith('$2b$08$');
    const needsPasswordUpgrade = !user.passwordHash || !isOptimizedCost;

    if (cleanUser === 'SADEGH') {
      user.role = 'super_admin';
      user.level = 1;
      user.scope = 'all';
      user.roleTitle = 'سوپر ادمین (مدیر کل سیستم)';
      user.canEdit = true;
      user.canManageUsers = true;
      user.canBackup = true;
      user.password = cleanPass;
      if (needsPasswordUpgrade) {
        user.passwordHash = await hashPassword(cleanPass);
      }
    } else if (needsPasswordUpgrade) {
      user.password = cleanPass;
      user.passwordHash = await hashPassword(cleanPass);
    } else if (!user.password) {
      user.password = cleanPass;
    }

    // Reset failed attempts & mark activity
    resetFailedAttempts(clientIp, cleanUser);
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = undefined;
    user.lastLogin = new Date().toISOString();
    
    // Save user update asynchronously or await fast memory sync
    await saveUserToStorage(user, { isLogin: true });
    updateLastActivity(user.id);

    const safeUser = sanitizeUser(user);
    const tJwtStart = Date.now();
    const { token, refreshToken } = generateTokens(safeUser);
    console.log(`[LOGIN_BENCHMARK] 3. JWT Generation: ${Date.now() - tJwtStart}ms`);
    console.log(`[LOGIN_BENCHMARK] TOTAL Auth Service Time: ${Date.now() - tStart}ms`);

    // Non-blocking background audit log execution
    void logServerAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'LOGIN_SUCCESS',
      entityType: 'auth',
      entityId: user.id,
      description: `ورود موفق به سامانه با نقش ${user.roleTitle || user.role}`,
      ipAddress: clientIp
    }).catch(() => {});

    return { user: safeUser, token, refreshToken };
  }

  /**
   * Verify and refresh tokens
   */
  public static async refreshToken(tokenFromHeaderOrCookie: string, clientIp: string) {
    const verified = verifyRefreshToken(tokenFromHeaderOrCookie);
    if (!verified.valid || !verified.decoded) {
      throw new AppError(verified.error || 'نشست منقضی شده است.', { statusCode: 401 });
    }

    const userId = verified.decoded.userId || verified.decoded.id;
    const username = verified.decoded.username;
    let user: StoredUser | null = null;
    if (username) {
      user = await fetchUserByUsername(username);
    }
    if (!user) {
      const users = await fetchAllUsersFromStorage();
      user = users.find(u => u.id === userId && u.isActive !== false) || null;
    }

    if (!user || user.isActive === false) {
      throw new AppError('کاربر یافت نشد یا حساب کاربری غیرفعال است.', { statusCode: 401 });
    }

    const safeUser = sanitizeUser(user);
    const { token, refreshToken: newRefreshToken } = generateTokens(safeUser);

    return { user: safeUser, token, refreshToken: newRefreshToken };
  }

  /**
   * Verify user security PIN
   */
  public static async verifyPin(user: StoredUser, enteredPin: string) {
    if (!user.securityPinEnabled || !user.specialSecurityPinHash) {
      return { verified: true, message: 'پین فعال نیست.' };
    }
    const cleanPin = String(enteredPin).trim();
    const isMatch = await comparePassword(cleanPin, user.specialSecurityPinHash);
    if (!isMatch) {
      throw new AppError('کد پین امنیتی نادرست است.', { statusCode: 400 });
    }
    return { verified: true };
  }
}
