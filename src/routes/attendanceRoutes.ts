import { Router } from 'express';
import { AttendanceController } from '../controllers/AttendanceController';

const router = Router();

// Sub-routes
router.post('/session', AttendanceController.recordSession);
router.post('/justify', AttendanceController.justifyAbsence);
router.get('/stats', AttendanceController.getStats);
router.get('/program/:programId', AttendanceController.getByProgram);
router.get('/student/:studentId', AttendanceController.getByStudent);
router.get('/', AttendanceController.getAll);

export default router;
