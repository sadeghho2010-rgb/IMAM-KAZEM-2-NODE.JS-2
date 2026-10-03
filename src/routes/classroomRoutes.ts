import { Router } from 'express';
import { ClassroomController } from '../controllers/ClassroomController';

const router = Router();

// Sub-routes before /:id
router.get('/:id/capacity', ClassroomController.getCapacity);

router.get('/', ClassroomController.getAll);
router.get('/:id', ClassroomController.getById);
router.post('/', ClassroomController.save);
router.put('/:id', ClassroomController.save);
router.delete('/:id', ClassroomController.delete);

export default router;
