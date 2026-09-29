import { Router } from 'express';
import * as reservationController from '../controllers/reservationController';
import { authenticateUser, authorizeModule, authorizeRole } from '../middlewares/auth';

const router = Router();

router.use(authenticateUser);
router.use(authorizeModule('APPOINTMENTS'));

router.post('/', authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), reservationController.create);
router.get('/', authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), reservationController.getAll);
router.get('/:id', authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), reservationController.getById);
router.put('/:id', authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), reservationController.update);
router.delete('/:id', authorizeRole(['OWNER', 'MANAGER']), reservationController.remove);

export default router;
