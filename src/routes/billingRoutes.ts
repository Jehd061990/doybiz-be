import { Router } from 'express';
import * as billingController from '../controllers/billingController';
import { authenticateUser, authorizeModule, authorizeRole } from '../middlewares/auth';

const router = Router();
const billingReaders = ['OWNER', 'MANAGER'];

router.post('/xendit/webhook', billingController.handleXenditWebhook);
router.use(authenticateUser);
router.use(authorizeModule('BILLING'));
router.get('/', authorizeRole(billingReaders), billingController.getAll);
router.post('/generate', authorizeRole(['OWNER']), billingController.generate);
router.post('/adjustments', authorizeRole(['OWNER']), billingController.createAdjustment);
router.post('/:id/xendit/payment', authorizeRole(['OWNER']), billingController.createXenditPaymentRequest);
router.get('/:id/payments', authorizeRole(billingReaders), billingController.getPayments);
router.post('/:id/payments', authorizeRole(['OWNER']), billingController.createPayment);
router.get('/:id', authorizeRole(billingReaders), billingController.getById);

export default router;