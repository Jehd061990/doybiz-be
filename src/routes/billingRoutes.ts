import { Router } from 'express';
import * as billingController from '../controllers/billingController';
import { authenticateUser, authorizeRole } from '../middlewares/auth';

const router = Router();
const billingReaders = ['OWNER', 'MANAGER'];

router.use(authenticateUser);
router.get('/', authorizeRole(billingReaders), billingController.getAll);
router.post('/generate', authorizeRole(['OWNER']), billingController.generate);
router.post('/adjustments', authorizeRole(['OWNER']), billingController.createAdjustment);
router.get('/:id/payments', authorizeRole(billingReaders), billingController.getPayments);
router.post('/:id/payments', authorizeRole(['OWNER']), billingController.createPayment);
router.get('/:id', authorizeRole(billingReaders), billingController.getById);

export default router;