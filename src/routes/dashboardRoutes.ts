import { Router } from 'express';
import * as reportController from '../controllers/reportController';
import { authenticateUser, authorizeRole } from '../middlewares/auth';

const router = Router();

router.use(authenticateUser);
router.get('/summary', authorizeRole(['OWNER', 'MANAGER']), reportController.dashboardSummary);

export default router;