import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { LoginInputSchema } from '../lib/validationSchemas';
import { verifyAccessToken, revokeToken, fetchAllUsersFromStorage, sanitizeUser } from '../lib/serverAuth';

export class AuthController {
  private static getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || '127.0.0.1';
  }

  public static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedLogin = LoginInputSchema.safeParse(req.body);
      if (!parsedLogin.success) {
        const errorMsg = parsedLogin.error.issues[0]?.message || 'اطلاعات ورودی نامعتبر است.';
        return res.status(400).json({ success: false, message: errorMsg });
      }

      const ip = AuthController.getClientIp(req);
      const result = await AuthService.login(parsedLogin.data.username, parsedLogin.data.password, ip);

      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

      res.cookie('auth_access_token', result.token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/'
      });

      res.cookie('auth_refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      return res.status(200).json({
        success: true,
        message: 'ورود با موفقیت انجام شد.',
        user: result.user,
        token: result.token,
        refreshToken: result.refreshToken
      });
    } catch (error) {
      next(error);
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
      const user = users.find(u => u.id === userId);

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

  public static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const accessToken = req.cookies?.auth_access_token;
      if (accessToken) revokeToken(accessToken);

      res.clearCookie('auth_access_token', { path: '/' });
      res.clearCookie('auth_refresh_token', { path: '/' });

      return res.status(200).json({ success: true, message: 'خروج از حساب کاربری انجام شد.' });
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
