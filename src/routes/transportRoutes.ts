import { Router } from 'express';
import { TransportController } from '../controllers/TransportController';

const router = Router();

router.get('/drivers', TransportController.getAllDrivers);
router.post('/drivers', TransportController.saveDriver);
router.delete('/drivers/:id', TransportController.deleteDriver);

router.get('/routines', TransportController.getRoutines);
router.post('/routines', TransportController.saveRoutine);

router.get('/trips', TransportController.getTrips);
router.post('/trips', TransportController.saveTrip);

export default router;
