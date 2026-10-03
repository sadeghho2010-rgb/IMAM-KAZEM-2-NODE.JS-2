import { Router } from 'express';
import { CounselingController } from '../controllers/CounselingController';

const router = Router();

router.get('/grades/student/:studentId', CounselingController.getByStudent);
router.get('/grades', CounselingController.getAllGrades);
router.post('/grades', CounselingController.saveGrade);
router.delete('/grades/:id', CounselingController.deleteGrade);

router.get('/proposals', CounselingController.getProposals);
router.post('/proposals', CounselingController.saveProposal);

export default router;
