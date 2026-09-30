import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticateUser, authorizeRole } from '../middlewares/auth';

const router = Router();

router.use(authenticateUser, authorizeRole(['OWNER']));
router.get('/seat-summary', userController.seatSummary);
router.get('/', userController.list);
router.post('/', userController.create);
router.get('/:id', userController.getById);
router.patch('/:id', userController.update);

export default router;
