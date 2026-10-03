import { Router } from 'express';
import { StudentRequestController } from '../controllers/StudentRequestController';

const router = Router();

router.get('/config', StudentRequestController.getConfig);
router.post('/config', StudentRequestController.saveConfig);

router.get('/', StudentRequestController.getAll);
router.get('/:id', StudentRequestController.getById);
router.post('/', StudentRequestController.create);
router.post('/:id/reply', StudentRequestController.reply);

export default router;
