import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';

const router = Router();

router.post('/login', AuthController.login);
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
