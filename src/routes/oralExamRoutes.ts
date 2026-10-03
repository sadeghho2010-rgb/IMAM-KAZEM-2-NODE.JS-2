import { Router } from 'express';
import { OralExamController } from '../controllers/OralExamController';

const router = Router();

// Sub-routes before /periods/:id
router.get('/report/:periodId', OralExamController.getReport);
router.get('/records', OralExamController.getRecordsByPeriod);
router.post('/records', OralExamController.saveStudentRecord);

router.get('/periods/:id', OralExamController.getPeriodById);
router.get('/periods', OralExamController.getAllPeriods);
router.post('/periods', OralExamController.savePeriod);

export default router;
