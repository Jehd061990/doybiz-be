import { Router } from 'express';
import * as publicController from '../controllers/publicController';
import { resolveTenant } from '../middlewares/tenantResolver';

const router = Router();

router.get('/site', resolveTenant, publicController.getSite);
router.get('/branches', resolveTenant, publicController.getBranches);
router.get('/services', resolveTenant, publicController.getServices);
router.get('/staff', resolveTenant, publicController.getStaff);
router.get('/availability', resolveTenant, publicController.getAvailability);
router.post('/reservations', resolveTenant, publicController.createReservation);

export default router;
