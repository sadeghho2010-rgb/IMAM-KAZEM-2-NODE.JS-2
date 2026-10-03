import { Router } from 'express';
import { ExpenseController } from '../controllers/ExpenseController';

const router = Router();

// Sub-routes before /:id
router.get('/report', ExpenseController.getReport);

router.get('/', ExpenseController.getAll);
router.post('/', ExpenseController.create);
router.delete('/:id', ExpenseController.delete);

export default router;
