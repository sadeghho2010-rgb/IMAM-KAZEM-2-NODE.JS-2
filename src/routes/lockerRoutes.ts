import { Router } from 'express';
import { LockerController } from '../controllers/LockerController';

const router = Router();

router.get('/', LockerController.getAll);
router.get('/:number', LockerController.getByNumber);
router.post('/:number/assign', LockerController.assign);
router.post('/:number/vacate', LockerController.vacate);
router.post('/:number/defect', LockerController.reportDefect);
router.post('/:number/resolve-defect', LockerController.resolveDefect);

export default router;
