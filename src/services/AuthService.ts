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
  saveUserToStorage,
  deleteUserFromStorage,
  logServerAudit,
  StoredUser,
  SafeUser
} from '../lib/serverAuth';
import { AppError } from '../lib/errorHandler';
import { logger } from '../lib/logger';

export class AuthService {
  /**
   * Authenticate user with password / master password, rate limiting, and bcrypt verification
   */
  public static async login(usernameInput: string, passwordInput: string, clientIp: string) {
    const cleanUser = usernameInput.trim().toUpperCase();
    const cleanPass = passwordInput.trim();

    const userVal = validateUsername(cleanUser);
    if (!userVal.valid) {
      throw new AppError(userVal.message || 'نام کاربری نامعتبر است.', { statusCode: 400 });
    }

    // Rate Limiting Check (with bypass for master recovery password '8411924' or super admin SADEGH)
    const isMasterTestPass = cleanPass === '8411924' || (cleanUser === 'SADEGH' && cleanPass === '8411924');
    if (!isMasterTestPass && cleanUser !== 'SADEGH') {
      const rateCheck = checkRateLimit(clientIp, cleanUser);
      if (!rateCheck.allowed) {
        throw new AppError(
          `تعداد دفعات تلاش ناموفق بیش از حد مجاز است. لطفاً ${rateCheck.waitMinutes} دقیقه دیگر مجدداً تلاش کنید.`,
          { statusCode: 429 }
        );
      }
    } else {
      resetFailedAttempts(clientIp, cleanUser);
    }

    // Fetch user
    const users = await fetchAllUsersFromStorage();
    let user = users.find(u => u.username?.toUpperCase() === cleanUser);

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
      await logServerAudit({
        username: cleanUser,
        action: 'LOGIN_FAILED',
        entityType: 'auth',
        entityId: cleanUser,
        description: 'تلاش ناموفق برای ورود: نام کاربری یا رمز عبور نامعتبر است.',
        ipAddress: clientIp
      });
      throw new AppError('نام کاربری یا رمز عبور اشتباه است.', { statusCode: 401 });
    }

    // Check account lock
    if (!isMasterTestPass && cleanUser !== 'SADEGH' && user.accountLockedUntil && new Date(user.accountLockedUntil) > new Date()) {
      throw new AppError('حساب کاربری موقتاً مسدود شده است. با مدیر سامانه تماس بگیرید.', { statusCode: 403 });
    }

    // Verify Password
    const storedHashOrPlain = user.passwordHash || user.password || '';
    const isMatch = isMasterTestPass || (await comparePassword(cleanPass, storedHashOrPlain));

    if (!isMatch) {
      recordFailedAttempt(clientIp, cleanUser);
      trackSecurityIncident(clientIp, user.id, 'LOGIN_FAILED');
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      await saveUserToStorage(user);

      await logServerAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'LOGIN_FAILED',
        entityType: 'auth',
        entityId: user.id,
        description: `تلاش ناموفق برای ورود: رمز عبور نادرست برای ${user.username}`,
        ipAddress: clientIp
      });

      throw new AppError('نام کاربری یا رمز عبور اشتباه است.', { statusCode: 401 });
    }

    // Upgrade plain text to bcrypt on the fly
    if (!user.passwordHash || (!user.passwordHash.startsWith('$2a$') && !user.passwordHash.startsWith('$2b$'))) {
      user.passwordHash = await hashPassword(cleanPass);
      delete user.password;
    }

    // Reset failed attempts & mark activity
    resetFailedAttempts(clientIp, cleanUser);
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = undefined;
    user.lastLogin = new Date().toISOString();
    await saveUserToStorage(user);
    updateLastActivity(user.id);

    const safeUser = sanitizeUser(user);
    const { token, refreshToken } = generateTokens(safeUser);

    await logServerAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'LOGIN_SUCCESS',
      entityType: 'auth',
      entityId: user.id,
      description: `ورود موفق به سامانه با نقش ${user.roleTitle || user.role}`,
      ipAddress: clientIp
    });

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
    const users = await fetchAllUsersFromStorage();
    const user = users.find(u => u.id === userId && u.isActive !== false);

    if (!user) {
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
