import { Router } from 'express';
import * as websiteController from '../controllers/websiteController';
import { authenticateUser, authorizeModule } from '../middlewares/auth';

const router = Router();

router.use(authenticateUser, authorizeModule('WEBSITE'));
router.get('/', websiteController.get);
router.put('/', websiteController.update);
router.post('/publish', websiteController.publish);

export default router;
