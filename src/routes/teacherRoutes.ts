import { Router } from 'express';
import { TeacherController } from '../controllers/TeacherController';

const router = Router();

router.get('/', TeacherController.getAll);
router.get('/:id', TeacherController.getById);
router.post('/', TeacherController.save);
router.put('/:id', TeacherController.save);
router.delete('/:id', TeacherController.delete);
router.get('/:id/schedule', TeacherController.getSchedule);

export default router;
