import { Router } from 'express';
import { TuitionController } from '../controllers/TuitionController';

const router = Router();

// Sub-routes before /:id
router.get('/report', TuitionController.getReport);
router.get('/student/:studentId', TuitionController.getByStudent);
router.post('/calculate', TuitionController.calculate);

router.get('/', TuitionController.getAll);
router.post('/', TuitionController.save);
router.put('/:id', TuitionController.save);
router.delete('/:id', TuitionController.delete);
router.post('/:id/pay', TuitionController.markPaid);

export default router;
