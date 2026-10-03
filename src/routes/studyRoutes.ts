import { Router } from 'express';
import { StudyController } from '../controllers/StudyController';

const router = Router();

// Sub-routes
router.get('/periods', StudyController.getAllPeriods);
router.get('/periods/:id', StudyController.getPeriodById);
router.post('/periods', StudyController.savePeriod);
router.put('/periods/:id', StudyController.savePeriod);
router.post('/log', StudyController.logHours);
router.get('/stats/student/:studentId', StudyController.getStudentStats);
router.get('/leaderboard', StudyController.getLeaderboard);

export default router;
