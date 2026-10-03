import { Router } from 'express';
import { CourseSelectionController } from '../controllers/CourseSelectionController';

const router = Router();

router.get('/requests/student/:studentId', CourseSelectionController.getRequestByStudent);
router.get('/requests', CourseSelectionController.getAllRequests);
router.post('/requests', CourseSelectionController.submit);
router.post('/requests/:id/review', CourseSelectionController.review);

router.get('/periods', CourseSelectionController.getAllPeriods);
router.post('/periods', CourseSelectionController.savePeriod);

export default router;
