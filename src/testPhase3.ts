import assert from 'assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getTestMongoUri } from './testDatabase';
import { registerOrganization } from './services/authService';
import * as saleService from './services/saleService';
import * as paymentService from './services/paymentService';
import Organization from './models/Organization';
import User from './models/User';
import Branch from './models/Branch';
import Customer from './models/Customer';
import Service from './models/Service';
import Reservation from './models/Reservation';
import Sale from './models/Sale';
import SaleItem from './models/SaleItem';
import Payment from './models/Payment';
import SaleCounter from './models/SaleCounter';

dotenv.config();

async function runTests() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/doybiz_test';
  await mongoose.connect(mongoUri);
  await Promise.all([
    Payment.deleteMany({}), SaleItem.deleteMany({}), Sale.deleteMany({}), SaleCounter.deleteMany({}),
    Reservation.deleteMany({}), Service.deleteMany({}), Customer.deleteMany({}), Branch.deleteMany({}),
    User.deleteMany({}), Organization.deleteMany({}),
  ]);

  const registered = await registerOrganization({
    orgName: 'Phase 3 Test Salon', slug: `phase3-${Date.now()}`, email: `owner-${Date.now()}@example.com`,
    phone: '09000000000', address: 'Test Address', userName: 'Phase 3 Owner', password: 'password123',
  });
  const organizationId = registered.org._id.toString();
  const branch = await Branch.create({ organizationId: registered.org._id, name: 'Main', address: 'Test', contactNumber: '09000000001' });
  const customer = await Customer.create({ organizationId: registered.org._id, firstName: 'Test', lastName: 'Customer', phone: `09${Date.now()}`, status: 'ACTIVE' });
  const service = await Service.create({ organizationId: registered.org._id, branchId: branch._id, name: 'Haircut', price: 300, durationMinutes: 30, status: 'ACTIVE' });

  const sale = await saleService.createSale({ branchId: branch._id.toString(), customerId: customer._id.toString(), items: [{ serviceId: service._id.toString(), quantity: 2 }] }, organizationId, registered.user);
  assert.equal(sale.total, 600);
  assert.equal((await SaleItem.countDocuments({ saleId: sale._id })).valueOf(), 1);

  const firstPayment = await paymentService.createPayment(sale._id.toString(), { amount: 600, paymentMethod: 'CASH', amountReceived: 700 }, organizationId, registered.user);
  assert.equal(firstPayment.sale.paymentStatus, 'PAID');
  assert.equal(firstPayment.payment.change, 100);

  const completedReservation = await Reservation.create({
    organizationId: registered.org._id, branchId: branch._id, customerId: customer._id, serviceId: service._id,
    staffId: new mongoose.Types.ObjectId(), appointmentDate: '2026-10-05', appointmentTime: '10:00',
    durationMinutes: 30, status: 'COMPLETED', source: 'ADMIN',
  });
  const converted = await saleService.createSaleFromReservation(completedReservation._id.toString(), organizationId, registered.user);
  assert.equal(converted.reservationId?.toString(), completedReservation._id.toString());
  await assert.rejects(() => saleService.createSaleFromReservation(completedReservation._id.toString(), organizationId, registered.user), /already been converted/);
  await assert.rejects(() => paymentService.createPayment(sale._id.toString(), { amount: 1, paymentMethod: 'CASH', amountReceived: 1 }, organizationId, registered.user), /already fully paid/);

  console.log('ALL PHASE 3 EMPIRICAL TESTS PASSED SUCCESSFULLY!');
  await mongoose.connection.close();
}

runTests().catch(async error => {
  console.error('Phase 3 test failed:', error);
  await mongoose.connection.close();
  process.exitCode = 1;
});