import { Router } from 'express';
import * as staffController from '../controllers/staffController';
import { authenticateUser, authorizeRole } from '../middlewares/auth';

const router = Router();

router.use(authenticateUser);

router.post('/', authorizeRole(['OWNER', 'MANAGER']), staffController.create);
router.get('/', authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), staffController.getAll);
router.get('/:id', authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), staffController.getById);
router.put('/:id', authorizeRole(['OWNER', 'MANAGER']), staffController.update);
router.delete('/:id', authorizeRole(['OWNER', 'MANAGER']), staffController.remove);

// Staff-Service Assignment Routes
router.post('/:staffId/services/:serviceId', authorizeRole(['OWNER', 'MANAGER']), staffController.assignService);
router.delete('/:staffId/services/:serviceId', authorizeRole(['OWNER', 'MANAGER']), staffController.unassignService);
router.get('/:staffId/services', authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), staffController.getServices);

export default router;
