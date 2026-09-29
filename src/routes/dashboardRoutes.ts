import { Router } from 'express';
import * as reportController from '../controllers/reportController';
import { authenticateUser, authorizeModule, authorizeRole } from '../middlewares/auth';

const router = Router();

router.use(authenticateUser);
router.use(authorizeModule('REPORTS'));
router.get('/summary', authorizeRole(['OWNER', 'MANAGER']), reportController.dashboardSummary);

export default router;