import { Router } from 'express';
import { ProgramController } from '../controllers/ProgramController';

const router = Router();

// Sub-routes must be registered before /:id to avoid path conflicts
router.get('/schedule/weekly', ProgramController.getWeeklySchedule);
router.get('/grade/:grade', ProgramController.getByGrade);
router.get('/teacher/:teacherId', ProgramController.getByTeacher);

router.get('/', ProgramController.getAll);
router.get('/:id', ProgramController.getById);
router.post('/', ProgramController.save);
router.put('/:id', ProgramController.save);
router.delete('/:id', ProgramController.delete);

export default router;
