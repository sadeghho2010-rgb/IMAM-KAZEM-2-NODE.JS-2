import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController';

const router = Router();

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
router.get('/users', AuthController.getUsers);
router.post('/add-user', AuthController.addUser);
router.post('/update-user', AuthController.updateUser);
router.post('/delete-user', AuthController.deleteUser);
router.post('/admin-reset-password', AuthController.adminResetPassword);
router.post('/change-password', AuthController.changePassword);
router.post('/logout', AuthController.logout);
router.post('/logout-all', AuthController.logoutAll);
router.post('/refresh', AuthController.refresh);

export default router;
