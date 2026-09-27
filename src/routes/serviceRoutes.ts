import { Router } from 'express';
import * as serviceController from '../controllers/serviceController';
import { authenticateUser, authorizeRole } from '../middlewares/auth';

const router = Router();

router.use(authenticateUser);

router.post('/', authorizeRole(['OWNER', 'MANAGER']), serviceController.create);
router.get('/', authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), serviceController.getAll);
router.get('/:id', authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), serviceController.getById);
router.put('/:id', authorizeRole(['OWNER', 'MANAGER']), serviceController.update);
router.delete('/:id', authorizeRole(['OWNER', 'MANAGER']), serviceController.remove);

export default router;
