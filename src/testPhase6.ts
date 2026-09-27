import assert from 'assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { registerOrganization } from './services/authService';
import * as billingService from './services/billingService';
import { authorizeRole } from './middlewares/auth';
import Organization from './models/Organization';
import User from './models/User';
import Branch from './models/Branch';
import SubscriptionPlan from './models/SubscriptionPlan';
import OrganizationSubscription from './models/OrganizationSubscription';
import BillingRecord from './models/BillingRecord';
import BillingPayment from './models/BillingPayment';
import BillingCounter from './models/BillingCounter';

dotenv.config();

const roleAllowed = (roles: string[], role: string) => {
  let nextCalled = false;
  let statusCode = 0;
  const middleware = authorizeRole(roles);
  middleware({ user: { role } } as any, { status(code: number) { statusCode = code; return this; }, json() { return this; } } as any, () => { nextCalled = true; });
  return { nextCalled, statusCode };
};

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/doybiz_test');
  await Promise.all([
    BillingPayment.deleteMany({}), BillingRecord.deleteMany({}), OrganizationSubscription.deleteMany({}), BillingCounter.deleteMany({}),
    SubscriptionPlan.deleteMany({}), User.deleteMany({}), Branch.deleteMany({}), Organization.deleteMany({}),
  ]);

  const suffix = Date.now();
  assert.equal(roleAllowed(['OWNER', 'MANAGER'], 'OWNER').nextCalled, true);
  assert.equal(roleAllowed(['OWNER', 'MANAGER'], 'MANAGER').nextCalled, true);
  assert.equal(roleAllowed(['OWNER', 'MANAGER'], 'CASHIER').statusCode, 403);
  assert.equal(roleAllowed(['OWNER'], 'MANAGER').statusCode, 403);
  const first = await registerOrganization({ orgName: 'Billing Org One', slug: `billing-one-${suffix}`, email: `billing-one-${suffix}@example.com`, phone: '09500000001', address: 'A', userName: 'Owner One', password: 'password123' });
  const second = await registerOrganization({ orgName: 'Billing Org Two', slug: `billing-two-${suffix}`, email: `billing-two-${suffix}@example.com`, phone: '09500000002', address: 'B', userName: 'Owner Two', password: 'password123' });
  for (const months of [1, 3, 6, 12] as const) {
    const termOrg = await registerOrganization({ orgName: `Prepaid ${months}`, slug: `prepaid-${months}-${suffix}`, email: `prepaid-${months}-${suffix}@example.com`, phone: `0960000000${months}`, address: 'Prepaid', userName: `Prepaid Owner ${months}`, password: 'password123' });
    const termBranch = await Branch.create({ organizationId: termOrg.org._id, name: 'Prepaid Branch', address: 'Prepaid', contactNumber: `096000000${months}`, status: 'ACTIVE', billingEffectiveAt: new Date(Date.now() - 86400000) });
    const termSubscription = await billingService.activateSubscription(termOrg.user, { paymentTermMonths: months });
    const termInvoice = await billingService.generateSubscriptionInvoice(termOrg.user);
    assert.equal(termSubscription.subscription.paymentTermMonths, months);
    assert.equal(termInvoice.totalAmount, 1499 * months);
    assert.equal((await billingService.generateSubscriptionInvoice(termOrg.user))._id.toString(), termInvoice._id.toString());
    assert.equal(await BillingRecord.countDocuments({ organizationId: termOrg.org._id, billingType: 'SUBSCRIPTION' }), 1);
    void termBranch;
  }

  const prepaidAdjustmentOrg = await registerOrganization({ orgName: 'Prepaid Adjustment Org', slug: `prepaid-adjust-${suffix}`, email: `prepaid-adjust-${suffix}@example.com`, phone: '09600000999', address: 'Adjustment', userName: 'Adjustment Owner', password: 'password123' });
  const originalBranch = await Branch.create({ organizationId: prepaidAdjustmentOrg.org._id, name: 'Original Branch', address: 'Original', contactNumber: '09600000010', status: 'ACTIVE', billingEffectiveAt: new Date('2025-12-31T00:00:00.000Z') });
  const prepaidSubscriptionResult = await billingService.activateSubscription(prepaidAdjustmentOrg.user, { paymentTermMonths: 6 });
  const prepaidSubscription = prepaidSubscriptionResult.subscription;
  prepaidSubscription.currentPeriodStart = new Date('2026-01-01T00:00:00.000Z');
  prepaidSubscription.currentPeriodEnd = new Date('2026-06-30T23:59:59.999Z');
  await prepaidSubscription.save();
  const originalInvoice = await billingService.generateSubscriptionInvoice(prepaidAdjustmentOrg.user);
  const originalInvoicePayment = await billingService.recordBillingPayment(originalInvoice._id.toString(), { amount: originalInvoice.totalAmount, paymentMethod: 'BANK_TRANSFER', idempotencyKey: `prepaid-original-${suffix}` }, prepaidAdjustmentOrg.user);
  assert.equal(originalInvoicePayment.record.status, 'PAID');

  const addedBranch = await Branch.create({ organizationId: prepaidAdjustmentOrg.org._id, name: 'Added Branch', address: 'Added', contactNumber: '09600000011', status: 'INACTIVE', billingEffectiveAt: new Date('2026-04-15T00:00:00.000Z') });
  const addedUserOne = await User.create({ organizationId: prepaidAdjustmentOrg.org._id, name: 'Added One', email: `added-one-${suffix}@example.com`, passwordHash: 'test', role: 'CASHIER', branchAccess: [addedBranch._id.toString()], status: 'ACTIVE', billingEffectiveAt: new Date('2026-04-15T00:00:00.000Z') });
  const addedUserTwo = await User.create({ organizationId: prepaidAdjustmentOrg.org._id, name: 'Added Two', email: `added-two-${suffix}@example.com`, passwordHash: 'test', role: 'CASHIER', branchAccess: [addedBranch._id.toString()], status: 'ACTIVE', billingEffectiveAt: new Date('2026-04-15T00:00:00.000Z') });
  const adjustment = await billingService.createMidTermAdjustment(prepaidAdjustmentOrg.user, { branches: [addedBranch._id.toString()], users: [{ userId: addedUserOne._id.toString(), branchId: addedBranch._id.toString() }, { userId: addedUserTwo._id.toString(), branchId: addedBranch._id.toString() }] });
  assert.equal(adjustment.billingType, 'ADJUSTMENT');
  assert.equal(adjustment.lineItems.length, 3);
  assert.equal(adjustment.status, 'PENDING');
  assert.equal(addedBranch.billingActivationPending, false);
  const pendingBranch = await Branch.findById(addedBranch._id);
  const pendingUser = await User.findById(addedUserOne._id);
  assert.equal(pendingBranch?.status, 'INACTIVE');
  assert.equal(pendingBranch?.billingActivationPending, true);
  assert.equal(pendingUser?.status, 'INACTIVE');
  assert.equal(pendingUser?.billingActivationPending, true);
  const refreshedAdjustment = await billingService.createMidTermAdjustment(prepaidAdjustmentOrg.user, { branches: [addedBranch._id.toString()], users: [{ userId: addedUserOne._id.toString(), branchId: addedBranch._id.toString() }] });
  assert.equal(refreshedAdjustment._id.toString(), adjustment._id.toString());
  assert.equal(await BillingRecord.countDocuments({ organizationId: prepaidAdjustmentOrg.org._id, billingType: 'ADJUSTMENT' }), 1);
  assert.equal(originalInvoice.totalAmount, originalInvoicePayment.record.totalAmount);
  const adjustmentPayment = await billingService.recordBillingPayment(adjustment._id.toString(), { amount: adjustment.totalAmount, paymentMethod: 'GCASH', idempotencyKey: `adjustment-${suffix}` }, prepaidAdjustmentOrg.user);
  assert.equal(adjustmentPayment.record.status, 'PAID');
  assert.equal((await Branch.findById(addedBranch._id))?.status, 'ACTIVE');
  assert.equal((await User.findById(addedUserOne._id))?.billingActivationPending, false);

  prepaidSubscription.currentPeriodStart = new Date('2026-07-01T00:00:00.000Z');
  prepaidSubscription.currentPeriodEnd = new Date('2026-12-31T23:59:59.999Z');
  await prepaidSubscription.save();
  const renewalInvoice = await billingService.generateSubscriptionInvoice(prepaidAdjustmentOrg.user);
  assert.equal(renewalInvoice.paymentTermMonths, 6);
  assert.ok(renewalInvoice.totalAmount >= 1499 * 6);
  void originalBranch;
  const branchA = await Branch.create({ organizationId: first.org._id, name: 'Branch A', address: 'A', contactNumber: '09500000003', status: 'ACTIVE' });
  const branchB = await Branch.create({ organizationId: first.org._id, name: 'Branch B', address: 'B', contactNumber: '09500000004', status: 'ACTIVE' });
  const branchC = await Branch.create({ organizationId: first.org._id, name: 'Branch C', address: 'C', contactNumber: '09500000005', status: 'ACTIVE' });
  const branchD = await Branch.create({ organizationId: first.org._id, name: 'Branch D', address: 'D', contactNumber: '09500000006', status: 'ACTIVE' });
  const branchE = await Branch.create({ organizationId: first.org._id, name: 'Branch E', address: 'E', contactNumber: '09500000007', status: 'ACTIVE' });
  const users = [
    { name: 'Manager A', email: `manager-a-${suffix}@example.com`, branchAccess: [branchA._id.toString()] },
    { name: 'Cashier A', email: `cashier-a-${suffix}@example.com`, branchAccess: [branchA._id.toString()] },
    { name: 'Manager B', email: `manager-b-${suffix}@example.com`, branchAccess: [branchB._id.toString()] },
    { name: 'Cashier B', email: `cashier-b-${suffix}@example.com`, branchAccess: [branchB._id.toString()] },
  ];
  await User.insertMany(users.map(user => ({ ...user, organizationId: first.org._id, passwordHash: 'test', role: 'MANAGER', status: 'ACTIVE' })));
  await Branch.updateMany({ _id: { $in: [branchC._id, branchD._id, branchE._id] } }, { $set: { status: 'INACTIVE' } });

  let estimate = await billingService.calculateEstimate(first.user);
  assert.equal(estimate.breakdown.length, 2);
  assert.equal(estimate.breakdown.find(item => item.branchId.toString() === branchA._id.toString())?.activeUsers, 3);
  assert.equal(estimate.breakdown.find(item => item.branchId.toString() === branchB._id.toString())?.activeUsers, 3);
  assert.equal(estimate.monthlyBranchCharges, 2998);
  assert.equal(estimate.additionalUserCharges, 0);
  assert.equal(estimate.monthlyTotal, 2998);
  assert.equal(estimate.setupFee, 5000);

  const extraUser = await User.create({ organizationId: first.org._id, name: 'Extra User', email: `extra-${suffix}@example.com`, passwordHash: 'test', role: 'CASHIER', branchAccess: [branchA._id.toString()], status: 'ACTIVE' });
  const extraUserTwo = await User.create({ organizationId: first.org._id, name: 'Extra User Two', email: `extra-two-${suffix}@example.com`, passwordHash: 'test', role: 'CASHIER', branchAccess: [branchA._id.toString()], status: 'ACTIVE' });
  await User.create({ organizationId: first.org._id, name: 'Inactive User', email: `inactive-${suffix}@example.com`, passwordHash: 'test', role: 'CASHIER', branchAccess: [branchA._id.toString()], status: 'INACTIVE' });
  estimate = await billingService.calculateEstimate(first.user);
  assert.equal(estimate.breakdown.find(item => item.branchId.toString() === branchA._id.toString())?.activeUsers, 5);
  assert.equal(estimate.breakdown.find(item => item.branchId.toString() === branchB._id.toString())?.activeUsers, 3);
  assert.equal(estimate.additionalUserCharges, 400);
  assert.equal(estimate.monthlyTotal, 3398);

  await Branch.updateMany({ _id: { $in: [branchC._id, branchD._id, branchE._id] } }, { $set: { status: 'ACTIVE' } });
  estimate = await billingService.calculateEstimate(first.user);
  assert.equal(estimate.breakdown.length, 5);
  assert.equal(estimate.monthlyTotal, 7895);

  const activated = await billingService.activateSubscription(first.user);
  assert.equal(activated.setupInvoice.totalAmount, 5000);
  assert.equal(activated.setupInvoice.billingType, 'SETUP');
  const activatedAgain = await billingService.activateSubscription(first.user);
  assert.equal(activatedAgain.setupInvoice._id.toString(), activated.setupInvoice._id.toString());
  assert.equal(await BillingRecord.countDocuments({ organizationId: first.org._id, billingType: 'SETUP' }), 1);

  const billingPeriod = { start: activated.subscription.currentPeriodStart, end: activated.subscription.currentPeriodEnd };
  const fullPeriodDate = new Date(billingPeriod.start.getTime());
  const halfwayDate = new Date(billingPeriod.start.getTime() + (billingPeriod.end.getTime() - billingPeriod.start.getTime()) / 2);
  const nearEndDate = new Date(billingPeriod.end.getTime() - 24 * 60 * 60 * 1000);
  const thirtyDayPeriod = { start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2026-01-30T23:59:59.999Z') };
  const thirtyOneDayPeriod = { start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2026-01-31T23:59:59.999Z') };
  branchA.billingEffectiveAt = new Date('2025-12-31T00:00:00.000Z');
  branchB.billingEffectiveAt = new Date('2026-01-16T00:00:00.000Z');
  await branchA.save();
  await branchB.save();
  const thirtyDayEstimate = await billingService.calculateEstimate(first.user, thirtyDayPeriod);
  const thirtyDayBranch = thirtyDayEstimate.breakdown.find(item => item.branchId.toString() === branchB._id.toString())!;
  assert.equal(thirtyDayBranch.branchDetails.totalBillingDays, 30);
  assert.equal(thirtyDayBranch.branchDetails.daysCharged, 15);
  assert.equal(thirtyDayBranch.branchCharge, 749.5);

  branchC.status = 'ACTIVE';
  branchC.billingEffectiveAt = new Date('2026-01-16T00:00:00.000Z');
  await branchC.save();
  const thirtyOneDayEstimate = await billingService.calculateEstimate(first.user, thirtyOneDayPeriod);
  const thirtyOneDayBranch = thirtyOneDayEstimate.breakdown.find(item => item.branchId.toString() === branchC._id.toString())!;
  assert.equal(thirtyOneDayBranch.branchDetails.totalBillingDays, 31);
  assert.equal(thirtyOneDayBranch.branchDetails.daysCharged, 16);
  assert.equal(thirtyOneDayBranch.branchCharge, 773.68);
  branchC.status = 'INACTIVE';
  await branchC.save();

  branchA.billingEffectiveAt = new Date(billingPeriod.start.getTime() - 1);
  branchB.billingEffectiveAt = halfwayDate;
  await branchA.save();
  await branchB.save();
  extraUser.billingEffectiveAt = fullPeriodDate;
  extraUserTwo.billingEffectiveAt = fullPeriodDate;
  await extraUser.save();
  await extraUserTwo.save();
  const fullPeriodEstimate = await billingService.calculateEstimate(first.user, billingPeriod);
  assert.equal(fullPeriodEstimate.additionalUserCharges, 400);

  extraUserTwo.billingEffectiveAt = halfwayDate;
  await extraUserTwo.save();
  const halfwayEstimate = await billingService.calculateEstimate(first.user, billingPeriod);
  const halfwayDetails = halfwayEstimate.breakdown.find(item => item.branchId.toString() === branchA._id.toString())!.additionalUserDetails;
  assert.equal(halfwayDetails.length, 2);
  assert.ok(Math.abs(halfwayDetails[1].proratedAmount - 100) <= 1);

  extraUser.billingEffectiveAt = nearEndDate;
  extraUserTwo.billingEffectiveAt = nearEndDate;
  await extraUser.save();
  await extraUserTwo.save();
  const nearEndEstimate = await billingService.calculateEstimate(first.user, billingPeriod);
  assert.ok(nearEndEstimate.additionalUserCharges > 0);
  assert.ok(nearEndEstimate.additionalUserCharges < 20);

  extraUser.billingEffectiveAt = fullPeriodDate;
  extraUserTwo.billingEffectiveAt = nearEndDate;
  await extraUser.save();
  await extraUserTwo.save();
  const consolidatedEstimate = await billingService.calculateEstimate(first.user, billingPeriod);
  const consolidatedDetails = consolidatedEstimate.breakdown.find(item => item.branchId.toString() === branchA._id.toString())!.additionalUserDetails;
  assert.equal(consolidatedDetails.length, 2);
  assert.notEqual(consolidatedDetails[0].userId.toString(), consolidatedDetails[1].userId.toString());

  extraUserTwo.status = 'INACTIVE';
  await extraUserTwo.save();
  const inactiveEstimate = await billingService.calculateEstimate(first.user, billingPeriod);
  assert.equal(inactiveEstimate.breakdown.find(item => item.branchId.toString() === branchA._id.toString())!.additionalUserDetails.length, 1);
  extraUserTwo.status = 'ACTIVE';
  extraUser.billingEffectiveAt = new Date(billingPeriod.start.getTime() - 1);
  extraUserTwo.billingEffectiveAt = new Date(billingPeriod.start.getTime() - 1);
  await extraUser.save();
  await extraUserTwo.save();
  extraUser.status = 'INACTIVE';
  extraUserTwo.status = 'INACTIVE';
  await extraUser.save();
  await extraUserTwo.save();
  const removedEstimate = await billingService.calculateEstimate(first.user, billingPeriod);
  assert.equal(removedEstimate.additionalUserCharges, 0);
  extraUser.status = 'ACTIVE';
  extraUserTwo.status = 'ACTIVE';
  extraUser.billingEffectiveAt = fullPeriodDate;
  extraUserTwo.billingEffectiveAt = halfwayDate;
  await extraUser.save();
  await extraUserTwo.save();

  branchC.status = 'ACTIVE';
  branchC.billingEffectiveAt = nearEndDate;
  branchD.status = 'ACTIVE';
  branchD.billingEffectiveAt = halfwayDate;
  branchE.status = 'ACTIVE';
  branchE.billingEffectiveAt = new Date(billingPeriod.start.getTime() - 1);
  await branchC.save();
  await branchD.save();
  await branchE.save();
  const expectedInvoice = await billingService.calculateEstimate(first.user);
  const invoice = await billingService.generateSubscriptionInvoice(first.user);
  assert.equal(invoice.totalAmount, expectedInvoice.monthlyTotal);
  assert.equal(invoice.setupFee, 0);
  assert.equal((await billingService.generateSubscriptionInvoice(first.user))._id.toString(), invoice._id.toString());
  const setupPayment = await billingService.recordBillingPayment(activated.setupInvoice._id.toString(), { amount: 5000, paymentMethod: 'BANK_TRANSFER', referenceNumber: 'SETUP-1', idempotencyKey: 'setup-payment-1' }, first.user);
  assert.equal(setupPayment.record.status, 'PAID');
  const setupReplay = await billingService.recordBillingPayment(activated.setupInvoice._id.toString(), { amount: 5000, paymentMethod: 'BANK_TRANSFER', referenceNumber: 'SETUP-1', idempotencyKey: 'setup-payment-1' }, first.user);
  assert.equal(setupReplay.payment._id.toString(), setupPayment.payment._id.toString());
  assert.equal(await BillingPayment.countDocuments({ billingRecordId: activated.setupInvoice._id }), 1);
  await assert.rejects(() => billingService.recordBillingPayment(activated.setupInvoice._id.toString(), { amount: 1, paymentMethod: 'CASH', idempotencyKey: 'setup-payment-2' }, first.user), /cannot accept payments/);

  assert.equal(invoice.lineItems.length, 7);
  const proratedLine = adjustment.lineItems.find(item => item.userId);
  assert.ok(proratedLine?.daysCharged);
  assert.ok(proratedLine?.totalBillingDays);
  assert.ok(proratedLine?.monthlyUnitPrice);
  assert.ok(proratedLine?.effectiveDate);
  const partial = await billingService.recordBillingPayment(invoice._id.toString(), { amount: 1000, paymentMethod: 'GCASH', referenceNumber: 'SUB-1', idempotencyKey: 'subscription-payment-1' }, first.user);
  assert.equal(partial.record.status, 'PENDING');
  const partialReplay = await billingService.recordBillingPayment(invoice._id.toString(), { amount: 1000, paymentMethod: 'GCASH', idempotencyKey: 'subscription-payment-1' }, first.user);
  assert.equal(partialReplay.payment._id.toString(), partial.payment._id.toString());
  assert.equal(await BillingPayment.countDocuments({ billingRecordId: invoice._id }), 1);
  const finalPayment = await billingService.recordBillingPayment(invoice._id.toString(), { amount: invoice.totalAmount - 1000, paymentMethod: 'BANK_TRANSFER', idempotencyKey: 'subscription-payment-2' }, first.user);
  assert.equal(finalPayment.record.status, 'PAID');
  await assert.rejects(() => billingService.recordBillingPayment(invoice._id.toString(), { amount: 1, paymentMethod: 'CASH', idempotencyKey: 'subscription-payment-3' }, first.user), /cannot accept payments/);

  const paidTotal = invoice.totalAmount;
  branchB.status = 'INACTIVE';
  await branchB.save();
  const paidRefresh = await billingService.generateSubscriptionInvoice(first.user);
  assert.equal(paidRefresh._id.toString(), invoice._id.toString());
  assert.equal(paidRefresh.totalAmount, paidTotal);
  assert.equal((await billingService.calculateEstimate(first.user, billingPeriod)).breakdown.some(item => item.branchId.toString() === branchB._id.toString()), false);

  const secondBranch = await Branch.create({ organizationId: second.org._id, name: 'Second Branch', address: 'Second', contactNumber: '09500000008', status: 'ACTIVE' });
  await billingService.activateSubscription(second.user);
  const secondInvoice = await billingService.generateSubscriptionInvoice(second.user);
  secondInvoice.status = 'VOID';
  await secondInvoice.save();
  secondBranch.billingEffectiveAt = new Date(secondInvoice.periodStart.getTime() + 5 * 24 * 60 * 60 * 1000);
  await secondBranch.save();
  const voidRefresh = await billingService.generateSubscriptionInvoice(second.user);
  assert.equal(voidRefresh._id.toString(), secondInvoice._id.toString());
  assert.equal(voidRefresh.totalAmount, secondInvoice.totalAmount);
  await assert.rejects(() => billingService.getBillingRecord(invoice._id.toString(), second.user), /not found/);
  await assert.rejects(() => billingService.recordBillingPayment(invoice._id.toString(), { amount: 1, paymentMethod: 'CASH' }, second.user), /not found/);
  const cancelled = await billingService.cancelSubscription(first.user);
  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal((await billingService.cancelSubscription(first.user)).status, 'CANCELLED');
  await assert.rejects(() => billingService.activateSubscription(first.user), /CANCELLED status/);
  assert.equal((await billingService.getSubscriptionAccess(first.org._id)).active, false);

  console.log('ALL PHASE 6 EMPIRICAL TESTS PASSED SUCCESSFULLY!');
  await mongoose.connection.close();
}

runTests().catch(async error => {
  console.error('Phase 6 test failed:', error);
  await mongoose.connection.close();
  process.exitCode = 1;
});