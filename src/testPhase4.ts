import assert from 'assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { registerOrganization } from './services/authService';
import * as reportService from './services/reportService';
import * as saleService from './services/saleService';
import * as paymentService from './services/paymentService';
import Organization from './models/Organization';
import User from './models/User';
import Branch from './models/Branch';
import Customer from './models/Customer';
import Service from './models/Service';
import Sale from './models/Sale';
import SaleCounter from './models/SaleCounter';
import SaleItem from './models/SaleItem';
import Payment from './models/Payment';
import Reservation from './models/Reservation';

dotenv.config();

const today = () => reportService.resolveDateRange({}).startDate;

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/doybiz_test');
  await Promise.all([
    Payment.deleteMany({}), SaleItem.deleteMany({}), Sale.deleteMany({}), SaleCounter.deleteMany({}),
    Reservation.deleteMany({}), Service.deleteMany({}), Customer.deleteMany({}), Branch.deleteMany({}),
    User.deleteMany({}), Organization.deleteMany({}),
  ]);

  const suffix = Date.now();
  const orgOne = await registerOrganization({ orgName: 'Report Org One', slug: `report-one-${suffix}`, email: `report-one-${suffix}@example.com`, phone: '09100000001', address: 'A', userName: 'Owner One', password: 'password123' });
  const orgTwo = await registerOrganization({ orgName: 'Report Org Two', slug: `report-two-${suffix}`, email: `report-two-${suffix}@example.com`, phone: '09100000002', address: 'B', userName: 'Owner Two', password: 'password123' });
  const branchA = await Branch.create({ organizationId: orgOne.org._id, name: 'Branch A', address: 'A', contactNumber: '09100000003' });
  const branchB = await Branch.create({ organizationId: orgOne.org._id, name: 'Branch B', address: 'B', contactNumber: '09100000004' });
  const branchOther = await Branch.create({ organizationId: orgTwo.org._id, name: 'Other Branch', address: 'C', contactNumber: '09100000005' });
  const customerOne = await Customer.create({ organizationId: orgOne.org._id, firstName: 'One', lastName: 'Customer', phone: `091${suffix}`, status: 'ACTIVE' });
  const customerOther = await Customer.create({ organizationId: orgTwo.org._id, firstName: 'Other', lastName: 'Customer', phone: `092${suffix}`, status: 'ACTIVE' });
  const serviceOne = await Service.create({ organizationId: orgOne.org._id, branchId: branchA._id, name: 'Haircut', price: 300, durationMinutes: 30, status: 'ACTIVE' });
  const serviceBranchB = await Service.create({ organizationId: orgOne.org._id, branchId: branchB._id, name: 'Haircut', price: 300, durationMinutes: 30, status: 'ACTIVE' });
  const serviceOther = await Service.create({ organizationId: orgTwo.org._id, branchId: branchOther._id, name: 'Other Service', price: 900, durationMinutes: 30, status: 'ACTIVE' });

  const saleA = await saleService.createSale({ branchId: branchA._id.toString(), customerId: customerOne._id.toString(), items: [{ serviceId: serviceOne._id.toString(), quantity: 2 }], tax: 60 }, orgOne.org._id.toString(), orgOne.user);
  const saleB = await saleService.createSale({ branchId: branchB._id.toString(), items: [{ serviceId: serviceBranchB._id.toString(), quantity: 1 }] }, orgOne.org._id.toString(), orgOne.user);
  await saleService.createSale({ branchId: branchOther._id.toString(), customerId: customerOther._id.toString(), items: [{ serviceId: serviceOther._id.toString(), quantity: 1 }] }, orgTwo.org._id.toString(), orgTwo.user);
  await paymentService.createPayment(saleA._id.toString(), { amount: 660, paymentMethod: 'CASH', amountReceived: 700 }, orgOne.org._id.toString(), orgOne.user);
  await paymentService.createPayment(saleB._id.toString(), { amount: 100, paymentMethod: 'GCASH', referenceNumber: 'TEST-1' }, orgOne.org._id.toString(), orgOne.user);

  const range = { startDate: today(), endDate: today() };
  const summary = await reportService.getSalesSummary(orgOne.user, range);
  assert.equal(summary.salesCount, 2);
  assert.equal(summary.netSales, 960);
  assert.equal(summary.amountPaid, 760);
  assert.equal(summary.unpaidAmount, 200);
  assert.equal((await reportService.getDailySales(orgOne.user, range)).length, 1);
  assert.equal((await reportService.getMonthlySales(orgOne.user, range)).length, 1);
  assert.equal((await reportService.getSalesByBranch(orgOne.user, range)).length, 2);
  const serviceRows = await reportService.getSalesByService(orgOne.user, range);
  assert.equal(serviceRows.reduce((total, row) => total + row.quantity, 0), 3);
  assert.equal((await reportService.getSalesByCashier(orgOne.user, range))[0].salesCount, 2);
  assert.equal((await reportService.getPaymentsByMethod(orgOne.user, range)).length, 2);
  const paymentSummary = await reportService.getPaymentSummary(orgOne.user, range);
  assert.equal(paymentSummary.PAID.salesCount, 1);
  assert.equal(paymentSummary.PARTIALLY_PAID.salesCount, 1);

  const manager = await User.create({ organizationId: orgOne.org._id, name: 'Branch Manager', email: `manager-${suffix}@example.com`, passwordHash: 'test', role: 'MANAGER', branchAccess: [branchA._id.toString()], status: 'ACTIVE' });
  const managerSummary = await reportService.getSalesSummary(manager, range);
  assert.equal(managerSummary.salesCount, 1);
  await assert.rejects(() => reportService.getSalesSummary(manager, { ...range, branchId: branchB._id.toString() }), /access to this branch/);

  const otherSummary = await reportService.getSalesSummary(orgOne.user, { ...range, branchId: branchOther._id.toString() }).catch(error => error);
  assert.match(otherSummary.message, /Branch not found in this organization/);
  await assert.rejects(() => reportService.getSalesSummary(orgOne.user, { startDate: '2026-02-31', endDate: today() }), /not a valid date/);
  await assert.rejects(() => reportService.getSalesSummary(orgOne.user, { startDate: today(), endDate: '2020-01-01' }), /before or equal/);

  const reservation = await Reservation.create({ organizationId: orgOne.org._id, branchId: branchA._id, customerId: customerOne._id, serviceId: serviceOne._id, staffId: new mongoose.Types.ObjectId(), appointmentDate: today(), appointmentTime: '10:00', durationMinutes: 30, status: 'COMPLETED', source: 'ADMIN' });
  assert.equal((await reportService.getReservationSummary(manager, range)).completed, 1);
  assert.equal((await reportService.getCustomerSummary(manager, range)).totalCustomers, 1);
  assert.equal((await reportService.getTopServices(orgOne.user, { ...range, limit: 1 })).length, 1);
  assert.equal((await reportService.getDashboardSummary(orgOne.user, range)).transactions.today, 2);
  await Reservation.deleteOne({ _id: reservation._id });

  console.log('ALL PHASE 4 EMPIRICAL TESTS PASSED SUCCESSFULLY!');
  await mongoose.connection.close();
}

runTests().catch(async error => {
  console.error('Phase 4 test failed:', error);
  await mongoose.connection.close();
  process.exitCode = 1;
});