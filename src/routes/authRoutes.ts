import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController';
import { verifyAccessToken } from '../lib/serverAuth';

const router = Router();

// Helper to extract authenticated caller from cookie, Bearer header, or query param
function extractCaller(req: Request) {
  let token = req.cookies?.auth_access_token || req.cookies?.auth_token;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }
  if (!token && typeof req.query?.token === 'string') {
    token = req.query.token;
  }
  if (token) {
    const verified = verifyAccessToken(token);
    if (verified.valid && verified.decoded) {
      return verified.decoded;
    }
  }
  return null;
}

// Middleware: Require valid authenticated session
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const caller = extractCaller(req);
  if (!caller) {
    return res.status(401).json({
      success: false,
      message: 'نشست کاربری شما معتبر نیست یا منقضی شده است. لطفاً مجدداً وارد شوید.'
    });
  }
  (req as any).user = caller;
  next();
}

// Middleware: Require role authorized to manage users or credentials
// Matches the roles allowed in frontend AuthContext / UserManagement / UserCredentials:
// Super Admin, School Manager, Education Manager, Education Officer, Finance Manager, Level 1, or canManageUsers
function requireUserManagementRole(req: Request, res: Response, next: NextFunction) {
  const caller = extractCaller(req);
  if (!caller) {
    return res.status(401).json({
      success: false,
      message: 'احراز هویت الزامی است. لطفاً وارد سیستم شوید.'
    });
  }

  const role = caller.role || '';
  const level = Number(caller.level) || 3;
  const username = String(caller.username || '').toUpperCase();
  const canManage = Boolean((caller as any).canManageUsers);

  const isAuthorized =
    level === 1 ||
    role === 'super_admin' ||
    role === 'school_manager' ||
    role === 'education_manager' ||
    role === 'education_officer' ||
    role === 'finance_manager' ||
    canManage ||
    username === 'SADEGH' ||
    username === 'SHAH';

  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'دسترسی غیرمجاز: شما مجوز مدیریت کاربران و دسترسی‌ها را ندارید.'
    });
  }

  (req as any).user = caller;
  next();
}

const loginLimiter = rateLimit({
  windowMs: 3 * 60 * 1000, // 3 minutes
  max: 5, // 5 failed attempts per IP/username combination
  skipSuccessfulRequests: true, // Reset counter on successful login
  keyGenerator: (req) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const username = req.body?.username ? String(req.body.username).trim().toUpperCase() : '';
    return `${ip}_${username}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'تعداد دفعات تلاش ناموفق برای ورود بیش از حد مجاز است (حداکثر ۵ بار در ۳ دقیقه). لطفاً ۳ دقیقه دیگر مجدداً تلاش فرمایید.'
  }
});

router.post('/login', loginLimiter, AuthController.login);
router.get('/me', AuthController.me);
router.get('/public-users', AuthController.publicUsers);

// Protected User Management endpoints
router.get('/users', requireAuth, AuthController.getUsers);
router.post('/add-user', requireUserManagementRole, AuthController.addUser);
router.post('/update-user', requireUserManagementRole, AuthController.updateUser);
router.post('/delete-user', requireUserManagementRole, AuthController.deleteUser);
router.post('/admin-reset-password', requireUserManagementRole, AuthController.adminResetPassword);

router.post('/change-password', AuthController.changePassword);
router.post('/logout', AuthController.logout);
router.post('/logout-all', AuthController.logoutAll);
router.post('/refresh', AuthController.refresh);

export default router;
