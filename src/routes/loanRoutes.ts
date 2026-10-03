import { Router } from 'express';
import { LoanController } from '../controllers/LoanController';

const router = Router();

// Sub-routes before /:id
router.get('/overdue', LoanController.getOverdue);
router.get('/report', LoanController.getReport);
router.get('/student/:studentId', LoanController.getByStudent);

router.get('/', LoanController.getAll);
router.post('/', LoanController.create);
router.post('/:id/payment', LoanController.recordPayment);

export default router;
