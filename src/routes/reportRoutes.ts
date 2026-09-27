import { Router } from 'express';
import * as reportController from '../controllers/reportController';
import { authenticateUser, authorizeRole } from '../middlewares/auth';

const router = Router();
const financialRoles = ['OWNER', 'MANAGER'];
const operationalRoles = ['OWNER', 'MANAGER', 'CASHIER'];

router.use(authenticateUser);

router.get('/sales/summary', authorizeRole(financialRoles), reportController.salesSummary);
router.get('/sales/daily', authorizeRole(financialRoles), reportController.dailySales);
router.get('/sales/monthly', authorizeRole(financialRoles), reportController.monthlySales);
router.get('/sales/by-branch', authorizeRole(financialRoles), reportController.salesByBranch);
router.get('/sales/by-service', authorizeRole(financialRoles), reportController.salesByService);
router.get('/sales/by-cashier', authorizeRole(financialRoles), reportController.salesByCashier);
router.get('/payments/by-method', authorizeRole(financialRoles), reportController.paymentsByMethod);
router.get('/payments/summary', authorizeRole(financialRoles), reportController.paymentsSummary);
router.get('/reservations/summary', authorizeRole(operationalRoles), reportController.reservationsSummary);
router.get('/customers/summary', authorizeRole(operationalRoles), reportController.customersSummary);
router.get('/services/top', authorizeRole(financialRoles), reportController.topServices);

export default router;