import { Router } from 'express';
import * as controller from '../controllers/platformAdminController';
import { authenticatePlatformAdmin } from '../middlewares/auth';

const router = Router();

router.use(authenticatePlatformAdmin);
router.get('/organizations', controller.listOrganizations);
router.post('/organizations', controller.createOrganization);
router.get('/organizations/:organizationId/branches', controller.listBranches);
router.post('/organizations/:organizationId/branches', controller.createBranch);
router.get('/organizations/:organizationId/users', controller.listUsers);
router.post('/organizations/:organizationId/users', controller.createUser);

export default router;
