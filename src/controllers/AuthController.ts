import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { LoginInputSchema } from '../lib/validationSchemas';
import { notifyRealtimeChange } from '../lib/serverDataApi';
import { logAudit } from '../lib/auditLogger';
import { recordLoginAuditInDb } from '../lib/databaseAbstraction';
import {
  verifyAccessToken,
  revokeToken,
  revokeAllUserSessions,
  fetchAllUsersFromStorage,
  saveUserToStorage,
  deleteUserFromStorage,
  sanitizeUser,
  hashPassword,
  comparePassword,
  logServerAudit,
  StoredUser
} from '../lib/serverAuth';

export class AuthController {
  private static getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || '127.0.0.1';
  }

  private static extractCaller(req: Request) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }

  public static async login(req: Request, res: Response, next: NextFunction) {
    const ip = AuthController.getClientIp(req);
    try {
      const parsedLogin = LoginInputSchema.safeParse(req.body);
      if (!parsedLogin.success) {
        const errorMsg = parsedLogin.error.issues[0]?.message || 'اطلاعات ورودی نامعتبر است.';
        await logAudit({
          action: 'login_failed',
          userName: req.body?.username || 'unknown',
          ipAddress: ip,
          status: 'failed',
          errorMessage: errorMsg
        });
        return res.status(400).json({ success: false, message: errorMsg });
      }

      const result = await AuthService.login(parsedLogin.data.username, parsedLogin.data.password, ip);

      // Force change password on first login: Do NOT issue tokens
      if (result.user && result.user.mustChangePassword) {
        return res.status(200).json({
          success: true,
          mustChangePassword: true,
          message: 'جهت حفظ امنیت سامانه، تغییر رمز عبور در اولین ورود الزامی است.',
          user: { id: result.user.id, username: result.user.username }
        });
      }

      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

      res.cookie('auth_access_token', result.token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
        path: '/'
      });

      res.cookie('auth_refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: isHttps,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      await logAudit({
        action: 'login',
        userId: result.user.id,
        userName: result.user.username,
        userRole: result.user.role,
        ipAddress: ip,
        status: 'success',
        details: { userLevel: result.user.level, name: result.user.name }
      });

      await recordLoginAuditInDb({
        username: result.user.username,
        success: true,
        ipAddress: ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(200).json({
        success: true,
        message: 'ورود با موفقیت انجام شد.',
        user: result.user,
        token: result.token,
        refreshToken: result.refreshToken
      });
    } catch (error: any) {
      const statusCode = error?.statusCode || (error?.status ? Number(error.status) : 401);
      const message = error?.message || 'نام کاربری یا رمز عبور اشتباه است.';

      await logAudit({
        action: 'login_failed',
        userName: req.body?.username || 'unknown',
        ipAddress: ip,
        status: 'failed',
        errorMessage: message
      }).catch(() => {});

      await recordLoginAuditInDb({
        username: req.body?.username || 'unknown',
        success: false,
        ipAddress: ip,
        userAgent: req.headers['user-agent']
      }).catch(() => {});

      return res.status(statusCode).json({
        success: false,
        message
      });
    }
  }

  public static async me(req: Request, res: Response, next: NextFunction) {
    try {
      let token = req.cookies?.auth_access_token;
      if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.substring(7);
      }

      if (!token) {
        return res.status(401).json({ authenticated: false, message: 'توکن دسترسی موجود نیست.' });
      }

      const verified = verifyAccessToken(token);
      if (!verified.valid || !verified.decoded) {
        return res.status(401).json({ authenticated: false, message: 'توکن منقضی یا نامعتبر است.' });
      }

      const userId = verified.decoded.userId || verified.decoded.id;
      const users = await fetchAllUsersFromStorage();
      const user = users.find(u => u.id === userId || u.username.toUpperCase() === (verified.decoded?.username || '').toUpperCase());

      if (!user || user.isActive === false) {
        return res.status(401).json({ authenticated: false, message: 'کاربر یافت نشد یا مسدود است.' });
      }

      return res.status(200).json({
        authenticated: true,
        user: sanitizeUser(user)
      });
    } catch (error) {
      next(error);
    }
  }

  public static async publicUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const isQuickLoginEnabled = process.env.ENABLE_QUICK_LOGIN === 'true';
      if (!isQuickLoginEnabled) {
        return res.status(200).json({
          success: false,
          enabled: false,
          message: 'ورود سریع در این محیط غیرفعال است.',
          users: []
        });
      }
      const users = await fetchAllUsersFromStorage();
      const sanitized = users.map(u => sanitizeUser(u));
      return res.status(200).json({
        success: true,
        enabled: true,
        count: sanitized.length,
        users: sanitized
      });
    } catch (error) {
      next(error);
    }
  }

  public static async addUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { user } = req.body;
      if (!user || !user.username) {
        return res.status(400).json({ success: false, message: 'اطلاعات کاربر نامعتبر است.' });
      }

      const cleanUsername = String(user.username).trim().toUpperCase();
      const plainPassword = user.password;
      if (!plainPassword) {
        return res.status(400).json({ success: false, message: 'رمز عبور الزامی است.' });
      }
      const passwordHash = await hashPassword(plainPassword);

      const userToStore: StoredUser = {
        ...user,
        id: user.id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        username: cleanUsername,
        name: user.name || user.fullName || cleanUsername,
        fullName: user.fullName || user.name || cleanUsername,
        role: user.role || 'custom',
        level: user.level || (user.role === 'teacher' ? 3 : 2),
        roleTitle: user.roleTitle || (user.role === 'teacher' ? 'استاد مدرسه' : 'کاربر سیستم'),
        scope: user.scope || (user.level === 3 ? 'self' : 'all'),
        gradeLabel: user.gradeLabel || '',
        avatarBg: user.avatarBg || (user.level === 1 ? 'bg-indigo-700' : 'bg-emerald-600'),
        allowedTabs: Array.isArray(user.allowedTabs) ? user.allowedTabs : ['todos', 'students'],
        editableTabs: Array.isArray(user.editableTabs) ? user.editableTabs : [],
        modulePermissions: user.modulePermissions || {},
        isActive: user.isActive !== false,
        passwordHash,
        password: plainPassword
      };

      await saveUserToStorage(userToStore);
      notifyRealtimeChange('system_users', userToStore.id, 'upsert');

      const caller = AuthController.extractCaller(req);
      logServerAudit({
        userId: caller?.userId || 'system',
        username: caller?.username || 'system',
        action: 'USER_CREATED',
        entityType: 'system_users',
        entityId: userToStore.id,
        description: `ایجاد کاربر جدید ${cleanUsername} (${userToStore.name}) با نقش ${userToStore.roleTitle || userToStore.role}`,
        ipAddress: AuthController.getClientIp(req)
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'کاربر با موفقیت در پایگاه داده ذخیره شد.',
        user: sanitizeUser(userToStore)
      });
    } catch (error) {
      next(error);
    }
  }

  public static async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { targetUserId, updates } = req.body;
      const target = targetUserId || updates?.id || updates?.username;
      if (!target) {
        return res.status(400).json({ success: false, message: 'شناسه کاربر الزامی است.' });
      }

      const users = await fetchAllUsersFromStorage();
      const existing = users.find(u => u.id === target || u.username.toUpperCase() === String(target).toUpperCase());

      if (!existing) {
        return res.status(404).json({ success: false, message: 'کاربر مورد نظر یافت نشد.' });
      }

      let passwordHash = existing.passwordHash;
      let plainPassword = existing.password;
      if (updates.password && updates.password.trim() !== '') {
        plainPassword = updates.password.trim();
        passwordHash = await hashPassword(plainPassword);
      }

      const updatedUser: StoredUser = {
        ...existing,
        ...updates,
        username: existing.username.toUpperCase(),
        passwordHash,
        password: plainPassword
      };

      await saveUserToStorage(updatedUser);
      notifyRealtimeChange('system_users', updatedUser.id, 'upsert');

      const caller = AuthController.extractCaller(req);
      logServerAudit({
        userId: caller?.userId || 'system',
        username: caller?.username || 'system',
        action: 'USER_UPDATED',
        entityType: 'system_users',
        entityId: updatedUser.id,
        description: `ویرایش اطلاعات کاربر ${updatedUser.username}`,
        ipAddress: AuthController.getClientIp(req)
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'کاربر با موفقیت به‌روزرسانی شد.',
        user: sanitizeUser(updatedUser)
      });
    } catch (error) {
      next(error);
    }
  }

  public static async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, username } = req.body;
      const target = userId || username || req.params.id;
      if (!target) {
        return res.status(400).json({ success: false, message: 'شناسه کاربر الزامی است.' });
      }

      await deleteUserFromStorage(target);
      notifyRealtimeChange('system_users', String(target), 'delete');

      const caller = AuthController.extractCaller(req);
      logServerAudit({
        userId: caller?.userId || 'system',
        username: caller?.username || 'system',
        action: 'USER_DELETED',
        entityType: 'system_users',
        entityId: target,
        description: `حذف کاربر ${target} از سیستم`,
        ipAddress: AuthController.getClientIp(req)
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'کاربر با موفقیت از پایگاه داده حذف گردید.'
      });
    } catch (error) {
      next(error);
    }
  }

  public static async adminResetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { targetUserId, newPassword } = req.body;
      if (!targetUserId || !newPassword) {
        return res.status(400).json({ success: false, message: 'شناسه کاربر و رمز عبور جدید الزامی است.' });
      }

      const users = await fetchAllUsersFromStorage();
      const existing = users.find(u => u.id === targetUserId || u.username.toUpperCase() === String(targetUserId).toUpperCase());

      if (!existing) {
        return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' });
      }

      const passwordHash = await hashPassword(newPassword.trim());
      existing.passwordHash = passwordHash;
      existing.password = newPassword.trim();
      existing.mustChangePassword = false;
      existing.failedLoginAttempts = 0;
      existing.accountLockedUntil = undefined;

      await saveUserToStorage(existing);
      notifyRealtimeChange('system_users', existing.id, 'upsert');

      return res.status(200).json({
        success: true,
        message: `رمز عبور کاربر ${existing.username} با موفقیت بازنشانی شد.`
      });
    } catch (error) {
      next(error);
    }
  }

  public static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = AuthController.extractCaller(req);
      if (!caller) {
        return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' });
      }

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'رمز عبور فعلی و رمز عبور جدید الزامی است.' });
      }

      const users = await fetchAllUsersFromStorage();
      const existing = users.find(u => u.id === caller.userId || u.username.toUpperCase() === caller.username.toUpperCase());

      if (!existing) {
        return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' });
      }

      const isCurrentMatch = await comparePassword(currentPassword, existing.passwordHash || existing.password || '');
      if (!isCurrentMatch) {
        return res.status(400).json({ success: false, message: 'رمز عبور فعلی نادرست است.' });
      }

      existing.passwordHash = await hashPassword(newPassword.trim());
      existing.password = newPassword.trim();
      existing.mustChangePassword = false;

      await saveUserToStorage(existing);

      return res.status(200).json({
        success: true,
        message: 'رمز عبور با موفقیت به‌روزرسانی شد.'
      });
    } catch (error) {
      next(error);
    }
  }

  public static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = AuthController.extractCaller(req);
      const ip = AuthController.getClientIp(req);

      const accessToken = req.cookies?.auth_access_token;
      if (accessToken) revokeToken(accessToken);

      res.clearCookie('auth_access_token', { path: '/' });
      res.clearCookie('auth_refresh_token', { path: '/' });

      if (caller) {
        await logAudit({
          action: 'logout',
          userId: String(caller.userId || caller.id || ''),
          userName: String(caller.username || caller.name || ''),
          userRole: caller.role,
          ipAddress: ip,
          status: 'success'
        });
      }

      return res.status(200).json({ success: true, message: 'خروج از حساب کاربری انجام شد.' });
    } catch (error) {
      next(error);
    }
  }

  public static async logoutAll(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = AuthController.extractCaller(req);
      if (caller?.userId) {
        revokeAllUserSessions(caller.userId);
      }
      res.clearCookie('auth_access_token', { path: '/' });
      res.clearCookie('auth_refresh_token', { path: '/' });

      return res.status(200).json({ success: true, message: 'تمام نشست‌های این حساب کاربری باطل شدند.' });
    } catch (error) {
      next(error);
    }
  }

  public static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.body?.refreshToken || req.cookies?.auth_refresh_token;
      if (!token) {
        return res.status(401).json({ success: false, message: 'رفرش توکن موجود نیست.' });
      }

      const ip = AuthController.getClientIp(req);
      const result = await AuthService.refreshToken(token, ip);

      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

      res.cookie('auth_access_token', result.token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/'
      });

      return res.status(200).json({
        success: true,
        token: result.token,
        refreshToken: result.refreshToken,
        user: result.user
      });
    } catch (error) {
      next(error);
    }
  }
}

