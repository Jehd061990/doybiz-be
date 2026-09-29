import { Router } from 'express';
import * as customerController from '../controllers/customerController';
import { authenticateUser, authorizeModule, authorizeRole } from '../middlewares/auth';

const router = Router();

router.use(authenticateUser);
router.use(authorizeModule('CUSTOMERS'));

router.post('/', authorizeRole(['OWNER', 'MANAGER']), customerController.create);
router.get('/', authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), customerController.getAll);
router.get('/:id', authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), customerController.getById);
router.put('/:id', authorizeRole(['OWNER', 'MANAGER']), customerController.update);
router.delete('/:id', authorizeRole(['OWNER', 'MANAGER']), customerController.remove);

export default router;
