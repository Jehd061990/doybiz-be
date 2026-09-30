import { Router } from 'express';
import * as serviceController from '../controllers/serviceController';
import { authenticateUser, authorizeModule, authorizeRole } from '../middlewares/auth';

const router = Router();

router.use(authenticateUser);

// Service catalog is independently manageable through SERVICES.
// POS may read active services so cashiers can sell them without needing appointment access.
router.get('/', authorizeModule(['POS', 'SERVICES']), authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), serviceController.getAll);
router.get('/:id', authorizeModule(['POS', 'SERVICES']), authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), serviceController.getById);

router.post('/', authorizeModule('SERVICES'), authorizeRole(['OWNER', 'MANAGER']), serviceController.create);
router.put('/:id', authorizeModule('SERVICES'), authorizeRole(['OWNER', 'MANAGER']), serviceController.update);
router.delete('/:id', authorizeModule('SERVICES'), authorizeRole(['OWNER', 'MANAGER']), serviceController.remove);
router.delete('/:id/image', authorizeModule('SERVICES'), authorizeRole(['OWNER', 'MANAGER']), serviceController.removeImage);

export default router;
