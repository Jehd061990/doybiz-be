import { Router } from 'express';
import * as subscriptionController from '../controllers/subscriptionController';
import { authenticateUser, authorizeRole } from '../middlewares/auth';

const router = Router();
const organizationAdmins = ['OWNER', 'MANAGER'];

router.use(authenticateUser);
router.get('/', authorizeRole(organizationAdmins), subscriptionController.getSubscription);
router.get('/plan', authorizeRole(organizationAdmins), subscriptionController.getPlan);
router.get('/estimate', authorizeRole(organizationAdmins), subscriptionController.getEstimate);
router.post('/activate', authorizeRole(['OWNER']), subscriptionController.activate);
router.post('/cancel', authorizeRole(['OWNER']), subscriptionController.cancel);

export default router;