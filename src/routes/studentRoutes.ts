import { Router } from 'express';
import { StudentController } from '../controllers/StudentController';

const router = Router();

router.get('/', StudentController.getAll);
router.get('/:id', StudentController.getById);
router.post('/', StudentController.save);
router.put('/:id', StudentController.save);
router.delete('/:id', StudentController.delete);

export default router;
