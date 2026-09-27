import { Router } from 'express';
import * as branchController from '../controllers/branchController';
import { authenticateUser, authorizeRole } from '../middlewares/auth';

const router = Router();

router.use(authenticateUser);

router.get('/', authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), branchController.getAll);
router.post('/', authorizeRole(['OWNER']), branchController.create);

export default router;
