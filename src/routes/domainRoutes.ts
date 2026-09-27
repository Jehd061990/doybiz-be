import { Router } from 'express';
import * as domainController from '../controllers/domainController';
import { authenticateUser, authorizeRole } from '../middlewares/auth';

const router = Router();
router.use(authenticateUser, authorizeRole(['OWNER']));
router.get('/', domainController.getAll);
router.post('/', domainController.create);
router.put('/:id', domainController.update);

export default router;