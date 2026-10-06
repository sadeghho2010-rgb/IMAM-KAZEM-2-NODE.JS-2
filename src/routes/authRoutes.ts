import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP/username
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'تعداد دفعات تلاش برای ورود بیش از حد مجاز است. لطفاً ۱۵ دقیقه دیگر مجدداً تلاش فرمایید.'
  }
});

router.post('/login', loginLimiter, AuthController.login);
router.get('/me', AuthController.me);
router.get('/public-users', AuthController.publicUsers);
router.get('/users', AuthController.publicUsers);
router.post('/add-user', AuthController.addUser);
router.post('/update-user', AuthController.updateUser);
router.post('/delete-user', AuthController.deleteUser);
router.post('/admin-reset-password', AuthController.adminResetPassword);
router.post('/change-password', AuthController.changePassword);
router.post('/logout', AuthController.logout);
router.post('/logout-all', AuthController.logoutAll);
router.post('/refresh', AuthController.refresh);

export default router;
