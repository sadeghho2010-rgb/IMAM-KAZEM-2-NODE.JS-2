import { Router } from 'express';
import { MealController } from '../controllers/MealController';

const router = Router();

router.get('/kitchen-stats', MealController.getKitchenStats);
router.get('/cancelled-days', MealController.getCancelledDays);
router.post('/cancelled-days', MealController.saveCancelledDay);
router.get('/reservations', MealController.getReservations);
router.post('/reservations', MealController.saveReservation);
router.get('/periods', MealController.getAllPeriods);
router.post('/periods', MealController.savePeriod);

export default router;
