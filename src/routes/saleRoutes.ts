import { Router } from 'express';
import * as saleController from '../controllers/saleController';
import { authenticateUser, authorizeModule, authorizeRole } from '../middlewares/auth';

const router = Router();
const salesRoles = ['OWNER', 'MANAGER', 'CASHIER'];

router.use(authenticateUser);
router.use(authorizeModule(['POS', 'SALES']));

router.post('/from-reservation/:reservationId', authorizeRole(salesRoles), saleController.createFromReservation);
router.post('/', authorizeRole(salesRoles), saleController.create);
router.get('/', authorizeRole(salesRoles), saleController.getAll);
router.get('/:saleId/receipt', authorizeRole(salesRoles), saleController.getReceipt);
router.get('/:saleId/payments', authorizeRole(salesRoles), saleController.getPayments);
router.post('/:saleId/payments', authorizeRole(salesRoles), saleController.addPayment);
router.post('/:saleId/void', authorizeRole(['OWNER', 'MANAGER']), saleController.voidSale);
router.get('/:id', authorizeRole(salesRoles), saleController.getById);
router.put('/:id', authorizeRole(['OWNER', 'MANAGER']), saleController.update);
router.delete('/:id', authorizeRole(['OWNER', 'MANAGER']), saleController.remove);

export default router;