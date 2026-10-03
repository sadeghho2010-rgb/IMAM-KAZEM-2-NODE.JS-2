import { Router } from 'express';
import { CalendarController } from '../controllers/CalendarController';

const router = Router();

router.get('/holidays', CalendarController.getHolidays);
router.post('/holidays', CalendarController.saveHoliday);
router.delete('/holidays/:id', CalendarController.deleteHoliday);

router.get('/weekly-programs', CalendarController.getWeeklyPrograms);
router.post('/weekly-programs', CalendarController.saveWeeklyProgram);
router.delete('/weekly-programs/:id', CalendarController.deleteWeeklyProgram);

router.get('/periods', CalendarController.getAllPeriods);
router.get('/periods/:id', CalendarController.getPeriodById);
router.post('/periods', CalendarController.savePeriod);

export default router;
