import assert from 'assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { login, registerOrganization } from './services/authService';
import * as billingService from './services/billingService';
import { authorizeRole } from './middlewares/auth';
import * as authController from './controllers/authController';
import Organization from './models/Organization';
import User from './models/User';
import Branch from './models/Branch';
import SubscriptionPlan from './models/SubscriptionPlan';
import OrganizationSubscription from './models/OrganizationSubscription';
import BillingRecord from './models/BillingRecord';
import BillingPayment from './models/BillingPayment';
import BillingCounter from './models/BillingCounter';
import { XenditService } from './services/xenditService';
import { canAccessBranch, canAccessModule } from './utils/branchAccess';
import { applyRolePreset, ROLE_PRESETS } from './utils/rolePermissions';
import * as userService from './services/userService';

dotenv.config();

const roleAllowed = (roles: string[], role: string) => {
  let nextCalled = false;
  let statusCode = 0;
  const middleware = authorizeRole(roles);
  middleware({ user: { role } } as any, { status(code: number) { statusCode = code; return this; }, json() { return this; } } as any, () => { nextCalled = true; });
  return { nextCalled, statusCode };
};

const captureResponse = async (handler: any, body: any) => {
  let statusCode = 0;
  let responseBody: any;
  const response: any = {
    status(code: number) { statusCode = code; return this; },
    json(value: any) { responseBody = value; return this; },
  };
  await handler({ body } as any, response);
  return { statusCode, body: responseBody };
};

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/doybiz_test');
  await BillingPayment.collection.dropIndexes();
  await Promise.all([
    BillingPayment.deleteMany({}), BillingRecord.deleteMany({}), OrganizationSubscription.deleteMany({}), BillingCounter.deleteMany({}),
    SubscriptionPlan.deleteMany({}), User.deleteMany({}), Branch.deleteMany({}), Organization.deleteMany({}),
  ]);

  const suffix = Date.now();
  const authCredentials = { email: `auth-contract-${suffix}@example.com`, password: 'password123' };
  const authRegistration = await captureResponse(authController.register, {
    orgName: 'Auth Contract Org', slug: `auth-contract-${suffix}`, ...authCredentials,
    phone: '09500000901', address: 'Auth', userName: 'Auth Contract Owner',
  });
  assert.equal(authRegistration.statusCode, 201);
  assert.equal(authRegistration.body.success, true);
  assert.equal(authRegistration.body.user.email, authCredentials.email);
  assert.equal(Object.prototype.hasOwnProperty.call(authRegistration.body.user, 'password'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(authRegistration.body.user, 'passwordHash'), false);
  assert.deepEqual(Object.keys(authRegistration.body.user).sort(), [
    '_id', 'organizationId', 'name', 'email', 'role', 'branchAccess', 'modulePermissions', 'permissionPreset', 'status', 'createdAt', 'updatedAt',
  ].sort());
  assert.equal(Object.prototype.hasOwnProperty.call(authRegistration.body.org, 'passwordHash'), false);
  const authLogin = await captureResponse(authController.login, authCredentials);
  assert.equal(authLogin.statusCode, 200);
  assert.equal(authLogin.body.user.organizationId, authRegistration.body.user.organizationId);
  assert.equal(Object.prototype.hasOwnProperty.call(authLogin.body.user, 'password'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(authLogin.body.user, 'passwordHash'), false);

  assert.equal(roleAllowed(['OWNER', 'MANAGER'], 'OWNER').nextCalled, true);
  assert.equal(roleAllowed(['OWNER', 'MANAGER'], 'MANAGER').nextCalled, true);
  assert.equal(roleAllowed(['OWNER', 'MANAGER'], 'CASHIER').statusCode, 403);
  assert.equal(roleAllowed(['OWNER'], 'MANAGER').statusCode, 403);
  assert.deepEqual(ROLE_PRESETS.CASHIER, ['POS', 'SALES', 'APPOINTMENTS', 'CUSTOMERS']);
  assert.deepEqual(ROLE_PRESETS.MANAGER, ['POS', 'SALES', 'APPOINTMENTS', 'SERVICES', 'CUSTOMERS', 'REPORTS', 'STAFF']);
  assert.deepEqual(applyRolePreset('CASHIER'), ROLE_PRESETS.CASHIER);
  const restrictedUser = { role: 'CASHIER', branchAccess: [], modulePermissions: ['POS', 'SALES'] } as any;
  assert.equal(canAccessModule(restrictedUser, 'POS'), true);
  assert.equal(canAccessModule(restrictedUser, 'BILLING'), false);
  assert.equal(canAccessBranch(restrictedUser, '507f1f77bcf86cd799439011'), false);
  restrictedUser.branchAccess = ['507f1f77bcf86cd799439011'];
  assert.equal(canAccessBranch(restrictedUser, '507f1f77bcf86cd799439011'), true);
  restrictedUser.branchAccess = 'ALL';
  assert.equal(canAccessBranch(restrictedUser, '507f1f77bcf86cd799439011'), false);

  const previousXenditKey = process.env.XENDIT_SECRET_KEY;
  const originalCreatePaymentRequest = (XenditService.prototype as any).createPaymentRequest;
  (XenditService.prototype as any).createPaymentRequest = async function (input: any) {
    return {
      id: 'xendit_request_123',
      status: 'ACCEPTING_PAYMENTS',
      reference_id: input.referenceId,
      actions: [{ name: 'checkout', url: 'https://example.com/checkout' }],
      metadata: input.metadata,
    };
  };
  process.env.XENDIT_SECRET_KEY = 'test_secret_key';

  const xenditOrg = await registerOrganization({ orgName: 'Xendit Org', slug: `xendit-${suffix}`, email: `xendit-${suffix}@example.com`, phone: '09500000099', address: 'X', userName: 'Xendit Owner', password: 'password123' });
  const xenditBranch = await Branch.create({ organizationId: xenditOrg.org._id, name: 'Xendit Branch', address: 'X', contactNumber: '09500000098', status: 'ACTIVE' });
  const xenditSubscription = await billingService.activateSubscription(xenditOrg.user, { paymentTermMonths: 3 });
  const xenditInvoice = await billingService.generateSubscriptionInvoice(xenditOrg.user);
  const xenditRequest = await billingService.createXenditPaymentRequest(xenditInvoice._id.toString(), xenditOrg.user, { amount: 1, paymentMethod: 'BANK_TRANSFER' });
  assert.equal(xenditRequest.record.totalAmount, xenditInvoice.totalAmount);
  assert.equal(xenditRequest.xenditPayment.amount, xenditInvoice.totalAmount);
  assert.equal(xenditRequest.payment.status, 'PENDING');
  assert.equal(xenditRequest.record.status, 'PENDING');
  assert.ok((xenditRequest.xenditPayment.id || '').includes('xendit'));
  assert.equal(xenditRequest.xenditPayment.currency, 'PHP');
  assert.equal(xenditRequest.xenditPayment.reference_id, `BILLING-${xenditInvoice._id.toString()}`);
  assert.equal((await billingService.getBillingRecord(xenditInvoice._id.toString(), xenditOrg.user)).outstandingAmount, xenditInvoice.totalAmount);

  const previousWebhookToken = process.env.XENDIT_WEBHOOK_TOKEN;
  process.env.XENDIT_WEBHOOK_TOKEN = 'test_webhook_secret';
  await assert.rejects(async () => billingService.reconcileXenditWebhook({
    event: 'payment_request.succeeded',
    data: {
      id: xenditRequest.xenditPayment.id,
      status: 'SUCCEEDED',
      amount: 1,
      currency: 'PHP',
      reference_id: `BILLING-${xenditInvoice._id.toString()}`,
      metadata: { organizationId: xenditOrg.org._id.toString(), billingRecordId: xenditInvoice._id.toString(), billingType: 'SUBSCRIPTION' },
    },
  }, { 'x-callback-token': 'test_webhook_secret' }), /amount/i);
  await assert.rejects(async () => billingService.reconcileXenditWebhook({ event: 'payment_request.succeeded', data: { id: xenditRequest.xenditPayment.id, status: 'SUCCEEDED', amount: xenditInvoice.totalAmount, currency: 'PHP', metadata: { billingRecordId: xenditInvoice._id.toString() } } }, { 'x-callback-token': 'wrong_token' }), /x-callback-token/i);
  const successfulWebhook = await billingService.reconcileXenditWebhook({
    event: 'payment_request.succeeded',
    data: {
      id: xenditRequest.xenditPayment.id,
      status: 'SUCCEEDED',
      amount: xenditInvoice.totalAmount,
      currency: 'PHP',
      reference_id: `BILLING-${xenditInvoice._id.toString()}`,
      metadata: { organizationId: xenditOrg.org._id.toString(), billingRecordId: xenditInvoice._id.toString(), billingType: 'SUBSCRIPTION' },
    },
  }, { 'x-callback-token': 'test_webhook_secret' });
  assert.equal(successfulWebhook.payment.status, 'COMPLETED');
  assert.equal(successfulWebhook.record.status, 'PAID');
  const replayWebhook = await billingService.reconcileXenditWebhook({
    event: 'payment_request.succeeded',
    data: {
      id: xenditRequest.xenditPayment.id,
      status: 'SUCCEEDED',
      amount: xenditInvoice.totalAmount,
      currency: 'PHP',
      reference_id: `BILLING-${xenditInvoice._id.toString()}`,
      metadata: { organizationId: xenditOrg.org._id.toString(), billingRecordId: xenditInvoice._id.toString(), billingType: 'SUBSCRIPTION' },
    },
  }, { 'x-callback-token': 'test_webhook_secret' });
  assert.equal(replayWebhook.payment._id.toString(), successfulWebhook.payment._id.toString());
  const xenditIncludedUsers = await Promise.all([1, 2].map(index => User.create({
    organizationId: xenditOrg.org._id,
    name: `Xendit Included ${index}`,
    email: `xendit-included-${index}-${suffix}@example.com`,
    passwordHash: 'test',
    role: 'CASHIER',
    branchAccess: [xenditBranch._id.toString()],
    status: 'ACTIVE',
  })));
  const xenditAddedUser = await User.create({
    organizationId: xenditOrg.org._id,
    name: 'Xendit Added User',
    email: `xendit-added-${suffix}@example.com`,
    passwordHash: 'test',
    role: 'CASHIER',
    branchAccess: [xenditBranch._id.toString()],
    status: 'ACTIVE',
    billingEffectiveAt: new Date(),
  });
  const xenditAdjustment = await billingService.createMidTermAdjustment(xenditOrg.user, { userIds: [xenditAddedUser._id.toString()] });
  assert.equal(xenditAdjustment.lineItems.length, 1);
  assert.equal(xenditAdjustment.lineItems[0].userId?.toString(), xenditAddedUser._id.toString());
  assert.equal((await User.findById(xenditAddedUser._id))?.billingActivationPending, true);
  const adjustmentProviderId = `xendit_adjustment_${suffix}`;
  (XenditService.prototype as any).createPaymentRequest = async function (input: any) {
    return { id: adjustmentProviderId, status: 'ACCEPTING_PAYMENTS', reference_id: input.referenceId, actions: [], metadata: input.metadata };
  };
  const xenditAdjustmentRequest = await billingService.createXenditPaymentRequest(xenditAdjustment._id.toString(), xenditOrg.user);
  const xenditAdjustmentWebhook = await billingService.reconcileXenditWebhook({
    event: 'payment_request.succeeded',
    data: {
      id: adjustmentProviderId,
      status: 'SUCCEEDED',
      amount: xenditAdjustment.totalAmount,
      currency: 'PHP',
      reference_id: `BILLING-${xenditAdjustment._id.toString()}`,
      metadata: { organizationId: xenditOrg.org._id.toString(), billingRecordId: xenditAdjustment._id.toString(), billingType: 'ADJUSTMENT' },
    },
  }, { 'x-callback-token': 'test_webhook_secret' });
  assert.equal(xenditAdjustmentRequest.payment.status, 'PENDING');
  assert.equal(xenditAdjustmentWebhook.payment.status, 'COMPLETED');
  assert.equal(xenditAdjustmentWebhook.record.status, 'PAID');
  assert.equal((await User.findById(xenditAddedUser._id))?.status, 'ACTIVE');
  assert.equal((await User.findById(xenditAddedUser._id))?.billingActivationPending, false);
  assert.equal((await User.findById(xenditIncludedUsers[0]._id))?.status, 'ACTIVE');
  process.env.XENDIT_WEBHOOK_TOKEN = previousWebhookToken;

  (XenditService.prototype as any).createPaymentRequest = originalCreatePaymentRequest;
  process.env.XENDIT_SECRET_KEY = '';
  const missingSecretService = new XenditService('', process.env.XENDIT_BASE_URL);
  await assert.rejects(async () => missingSecretService.createPaymentRequest({ amount: 100, currency: 'PHP', country: 'PH', referenceId: 'test' }), /XENDIT_SECRET_KEY/);
  process.env.XENDIT_SECRET_KEY = previousXenditKey;

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
  const secondPrepaidBranch = await Branch.create({ organizationId: prepaidAdjustmentOrg.org._id, name: 'Second Branch', address: 'Second', contactNumber: '09600000012', status: 'ACTIVE', billingEffectiveAt: new Date('2025-12-31T00:00:00.000Z') });
  for (let index = 0; index < 5; index += 1) {
    await User.create({ organizationId: prepaidAdjustmentOrg.org._id, name: `Included User ${index + 1}`, email: `included-${index + 1}-${suffix}@example.com`, passwordHash: 'test', role: 'CASHIER', branchAccess: index % 2 === 0 ? [originalBranch._id.toString(), secondPrepaidBranch._id.toString()] : [originalBranch._id.toString()], status: 'ACTIVE' });
  }
  const prepaidSubscriptionResult = await billingService.activateSubscription(prepaidAdjustmentOrg.user, { paymentTermMonths: 6 });
  const prepaidSubscription = prepaidSubscriptionResult.subscription;
  prepaidSubscription.currentPeriodStart = new Date('2026-01-01T00:00:00.000Z');
  prepaidSubscription.currentPeriodEnd = new Date('2026-06-30T23:59:59.999Z');
  await prepaidSubscription.save();
  const originalInvoice = await billingService.generateSubscriptionInvoice(prepaidAdjustmentOrg.user);
  assert.equal(originalInvoice.totalAmount, 2998 * 6);
  const originalInvoicePayment = await billingService.recordBillingPayment(originalInvoice._id.toString(), { amount: originalInvoice.totalAmount, paymentMethod: 'BANK_TRANSFER', idempotencyKey: `prepaid-original-${suffix}` }, prepaidAdjustmentOrg.user);
  assert.equal(originalInvoicePayment.record.status, 'PAID');

  const addedUser = await User.create({ organizationId: prepaidAdjustmentOrg.org._id, name: 'Added User', email: `added-user-${suffix}@example.com`, passwordHash: 'test', role: 'CASHIER', branchAccess: [originalBranch._id.toString(), secondPrepaidBranch._id.toString()], status: 'ACTIVE', billingEffectiveAt: new Date('2026-04-15T00:00:00.000Z') });
  const adjustment = await billingService.createMidTermAdjustment(prepaidAdjustmentOrg.user, { userIds: [addedUser._id.toString()] });
  assert.equal(adjustment.billingType, 'ADJUSTMENT');
  assert.equal(adjustment.lineItems.length, 1);
  assert.equal(adjustment.lineItems[0].userId?.toString(), addedUser._id.toString());
  assert.equal(adjustment.lineItems[0].branchId, undefined);
  assert.ok(Math.abs(adjustment.lineItems[0].amount - 506.67) < 0.01);
  assert.equal(adjustment.status, 'PENDING');
  const pendingUser = await User.findById(addedUser._id);
  assert.equal(pendingUser?.status, 'INACTIVE');
  assert.equal(pendingUser?.billingActivationPending, true);
  const refreshedAdjustment = await billingService.createMidTermAdjustment(prepaidAdjustmentOrg.user, { userIds: [addedUser._id.toString()] });
  assert.equal(refreshedAdjustment._id.toString(), adjustment._id.toString());
  assert.equal(await BillingRecord.countDocuments({ organizationId: prepaidAdjustmentOrg.org._id, billingType: 'ADJUSTMENT' }), 1);
  const adjustmentPayment = await billingService.recordBillingPayment(adjustment._id.toString(), { amount: adjustment.totalAmount, paymentMethod: 'GCASH', idempotencyKey: `adjustment-${suffix}` }, prepaidAdjustmentOrg.user);
  assert.equal(adjustmentPayment.record.status, 'PAID');
  assert.equal((await User.findById(addedUser._id))?.status, 'ACTIVE');
  assert.equal((await User.findById(addedUser._id))?.billingActivationPending, false);
  assert.equal((await BillingRecord.findById(originalInvoice._id))?.totalAmount, originalInvoicePayment.record.totalAmount);

  const addedBranch = await Branch.create({ organizationId: prepaidAdjustmentOrg.org._id, name: 'Added Branch', address: 'Added', contactNumber: '09600000011', status: 'INACTIVE', billingEffectiveAt: new Date('2026-04-15T00:00:00.000Z') });
  const branchAdjustment = await billingService.createMidTermAdjustment(prepaidAdjustmentOrg.user, { branches: [addedBranch._id.toString()] });
  assert.equal(branchAdjustment.lineItems.length, 1);
  const pendingBranch = await Branch.findById(addedBranch._id);
  assert.equal(pendingBranch?.status, 'INACTIVE');
  assert.equal(pendingBranch?.billingActivationPending, true);
  const branchAdjustmentPayment = await billingService.recordBillingPayment(branchAdjustment._id.toString(), { amount: branchAdjustment.totalAmount, paymentMethod: 'GCASH', idempotencyKey: `branch-adjustment-${suffix}` }, prepaidAdjustmentOrg.user);
  assert.equal(branchAdjustmentPayment.record.status, 'PAID');
  assert.equal((await Branch.findById(addedBranch._id))?.status, 'ACTIVE');
  assert.equal((await BillingRecord.findById(originalInvoice._id))?.totalAmount, originalInvoice.totalAmount);

  prepaidSubscription.currentPeriodStart = new Date('2026-07-01T00:00:00.000Z');
  prepaidSubscription.currentPeriodEnd = new Date('2026-12-31T23:59:59.999Z');
  await prepaidSubscription.save();
  const renewalInvoice = await billingService.generateSubscriptionInvoice(prepaidAdjustmentOrg.user);
  assert.equal(renewalInvoice.paymentTermMonths, 6);
  assert.equal(renewalInvoice.totalAmount, 1499 * 3 * 6);
  void originalBranch;
  const branchA = await Branch.create({ organizationId: first.org._id, name: 'Branch A', address: 'A', contactNumber: '09500000003', status: 'ACTIVE' });
  const branchB = await Branch.create({ organizationId: first.org._id, name: 'Branch B', address: 'B', contactNumber: '09500000004', status: 'ACTIVE' });
  const branchC = await Branch.create({ organizationId: first.org._id, name: 'Branch C', address: 'C', contactNumber: '09500000005', status: 'ACTIVE' });
  const branchD = await Branch.create({ organizationId: first.org._id, name: 'Branch D', address: 'D', contactNumber: '09500000006', status: 'ACTIVE' });
  const branchE = await Branch.create({ organizationId: first.org._id, name: 'Branch E', address: 'E', contactNumber: '09500000007', status: 'ACTIVE' });
  const foreignBranch = await Branch.create({ organizationId: second.org._id, name: 'Foreign Branch', address: 'Foreign', contactNumber: '09500000008', status: 'ACTIVE' });
  const managedUser = await userService.createOrganizationUser(first.org._id, {
    name: 'Permission Test User', email: `permission-${suffix}@example.com`, password: 'password123', role: 'CASHIER',
    branchAccess: [branchA._id.toString(), branchB._id.toString()], permissionPreset: 'CASHIER', status: 'INACTIVE',
  });
  assert.deepEqual(managedUser.modulePermissions, ROLE_PRESETS.CASHIER);
  const presetOnlyUpdate = await userService.updateOrganizationUser(first.org._id, managedUser._id.toString(), { permissionPreset: 'MANAGER' });
  assert.deepEqual(presetOnlyUpdate.modulePermissions, ROLE_PRESETS.CASHIER);
  const customizedPermissions = await userService.updateOrganizationUser(first.org._id, managedUser._id.toString(), { modulePermissions: [...ROLE_PRESETS.CASHIER, 'BILLING'] });
  assert.ok(customizedPermissions.modulePermissions.includes('BILLING'));
  const retainedCustomization = await userService.updateOrganizationUser(first.org._id, managedUser._id.toString(), { permissionPreset: 'CASHIER' });
  assert.ok(retainedCustomization.modulePermissions.includes('BILLING'));
  const resetPermissions = await userService.updateOrganizationUser(first.org._id, managedUser._id.toString(), { permissionPreset: 'CASHIER', applyPreset: true });
  assert.deepEqual(resetPermissions.modulePermissions, ROLE_PRESETS.CASHIER);
  await assert.rejects(() => userService.updateOrganizationUser(first.org._id, managedUser._id.toString(), { modulePermissions: ['INVENTORY'] }), /Invalid module permission/);
  await assert.rejects(() => userService.updateOrganizationUser(first.org._id, managedUser._id.toString(), { branchAccess: [foreignBranch._id.toString()] }), /do not belong to this organization/);
  await assert.rejects(() => userService.updateOrganizationUser(second.org._id, managedUser._id.toString(), { status: 'INACTIVE' }), /not found in this organization/);
  await assert.rejects(() => userService.updateOrganizationUser(first.org._id, first.user._id.toString(), { role: 'MANAGER' }), /at least one active owner/);
  const users = [
    { name: 'Manager A', email: `manager-a-${suffix}@example.com`, branchAccess: [branchA._id.toString(), branchB._id.toString()], role: 'MANAGER' },
    { name: 'Cashier A1', email: `cashier-a1-${suffix}@example.com`, branchAccess: [branchA._id.toString()], role: 'CASHIER' },
    { name: 'Cashier A2', email: `cashier-a2-${suffix}@example.com`, branchAccess: [branchA._id.toString()], role: 'CASHIER' },
    { name: 'Cashier B1', email: `cashier-b1-${suffix}@example.com`, branchAccess: [branchB._id.toString()], role: 'CASHIER' },
    { name: 'Cashier B2', email: `cashier-b2-${suffix}@example.com`, branchAccess: [branchB._id.toString()], role: 'CASHIER' },
  ];
  await User.insertMany(users.map(user => ({ ...user, organizationId: first.org._id, passwordHash: 'test', status: 'ACTIVE' })));
  await Branch.updateMany({ _id: { $in: [branchC._id, branchD._id, branchE._id] } }, { $set: { status: 'INACTIVE' } });

  let estimate = await billingService.calculateEstimate(first.user);
  assert.equal(estimate.breakdown.length, 2);
  assert.equal(estimate.activeOrganizationUsers, 6);
  assert.equal(estimate.includedUserSeats, 6);
  assert.equal(estimate.additionalUserCount, 0);
  assert.equal(estimate.monthlyBranchCharges, 2998);
  assert.equal(estimate.additionalUserCharges, 0);
  assert.equal(estimate.monthlyTotal, 2998);
  assert.equal(estimate.setupFee, 5000);

  const extraUser = await User.create({ organizationId: first.org._id, name: 'Extra User', email: `extra-${suffix}@example.com`, passwordHash: 'test', role: 'CASHIER', branchAccess: [branchA._id.toString(), branchB._id.toString()], status: 'ACTIVE' });
  await User.create({ organizationId: first.org._id, name: 'Inactive User', email: `inactive-${suffix}@example.com`, passwordHash: 'test', role: 'CASHIER', branchAccess: [branchA._id.toString()], status: 'INACTIVE' });
  estimate = await billingService.calculateEstimate(first.user);
  assert.equal(estimate.activeOrganizationUsers, 7);
  assert.equal(estimate.includedUserSeats, 6);
  assert.equal(estimate.additionalUserCount, 1);
  assert.equal(estimate.additionalUserCharges, 200);
  assert.equal(estimate.monthlyTotal, 3198);
  extraUser.status = 'INACTIVE';
  await extraUser.save();
  estimate = await billingService.calculateEstimate(first.user);
  assert.equal(estimate.activeOrganizationUsers, 6);
  assert.equal(estimate.additionalUserCount, 0);
  assert.equal(estimate.additionalUserCharges, 0);
  extraUser.status = 'ACTIVE';
  await extraUser.save();

  await Branch.updateOne({ _id: branchC._id, organizationId: first.org._id }, { $set: { status: 'ACTIVE' } });
  extraUser.branchAccess = [branchA._id.toString(), branchB._id.toString(), branchC._id.toString()];
  await extraUser.save();
  estimate = await billingService.calculateEstimate(first.user);
  assert.equal(estimate.activeOrganizationUsers, 7);
  assert.equal(estimate.includedUserSeats, 9);
  assert.equal(estimate.additionalUserCount, 0);
  assert.equal(estimate.additionalUserCharges, 0);
  assert.equal(estimate.monthlyTotal, 4497);
  branchC.status = 'INACTIVE';
  await branchC.save();

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
  const extraUserTwo = await User.create({ organizationId: first.org._id, name: 'Extra User Two', email: `extra-two-${suffix}@example.com`, passwordHash: 'test', role: 'CASHIER', branchAccess: [branchA._id.toString(), branchB._id.toString()], status: 'ACTIVE' });
  extraUser.billingEffectiveAt = fullPeriodDate;
  extraUserTwo.billingEffectiveAt = fullPeriodDate;
  await extraUser.save();
  await extraUserTwo.save();
  const fullPeriodEstimate = await billingService.calculateEstimate(first.user, billingPeriod);
  assert.equal(fullPeriodEstimate.additionalUserCharges, 400);

  extraUserTwo.billingEffectiveAt = halfwayDate;
  await extraUserTwo.save();
  const halfwayEstimate = await billingService.calculateEstimate(first.user, billingPeriod);
  const halfwayDetails = halfwayEstimate.additionalUserDetails;
  assert.equal(halfwayDetails.length, 2);
  assert.equal(
    halfwayDetails[1].daysCharged,
    Math.ceil(
      (billingPeriod.end.getTime() - halfwayDate.getTime()) /
        (24 * 60 * 60 * 1000)
    )
  );
  assert.ok(
    Math.abs(
      halfwayDetails[1].proratedAmount -
        (200 * halfwayDetails[1].daysCharged!) /
          halfwayDetails[1].totalBillingDays!
    ) <= 0.01
  );

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
  const consolidatedDetails = consolidatedEstimate.additionalUserDetails;
  assert.equal(consolidatedDetails.length, 2);
  assert.notEqual(consolidatedDetails[0].userId.toString(), consolidatedDetails[1].userId.toString());

  extraUserTwo.status = 'INACTIVE';
  await extraUserTwo.save();
  const inactiveEstimate = await billingService.calculateEstimate(first.user, billingPeriod);
  assert.equal(inactiveEstimate.activeOrganizationUsers, 7);
  assert.equal(inactiveEstimate.additionalUserDetails.length, 1);
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
  assert.equal(removedEstimate.activeOrganizationUsers, 6);
  assert.equal(removedEstimate.additionalUserCharges, 0);
  extraUser.status = 'ACTIVE';
  extraUserTwo.status = 'ACTIVE';
  extraUser.billingEffectiveAt = fullPeriodDate;
  extraUserTwo.billingEffectiveAt = halfwayDate;
  await extraUser.save();
  await extraUserTwo.save();

  await Branch.updateOne({ _id: branchC._id, organizationId: first.org._id }, { $set: { status: 'ACTIVE', billingEffectiveAt: nearEndDate } });
  await Branch.updateOne({ _id: branchD._id, organizationId: first.org._id }, { $set: { status: 'ACTIVE', billingEffectiveAt: halfwayDate } });
  await Branch.updateOne({ _id: branchE._id, organizationId: first.org._id }, { $set: { status: 'ACTIVE', billingEffectiveAt: new Date(billingPeriod.start.getTime() - 1) } });
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

  assert.equal(invoice.lineItems.length, 5);
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

  const duplicateLoginEmail = `shared-login-${suffix}@example.com`;
  const duplicateLoginAccount = {
    name: 'Shared Login User', email: duplicateLoginEmail, password: 'password123', role: 'CASHIER',
    branchAccess: [], status: 'ACTIVE',
  };
  await userService.createOrganizationUser(first.org._id, duplicateLoginAccount);
  await userService.createOrganizationUser(second.org._id, duplicateLoginAccount);
  await assert.rejects(() => login({ email: duplicateLoginEmail, password: duplicateLoginAccount.password }), /organizationId is required when email is associated with multiple organizations/);
  const firstOrgLogin = await login({ email: duplicateLoginEmail, password: duplicateLoginAccount.password, organizationId: first.org._id.toString() });
  const secondOrgLogin = await login({ email: duplicateLoginEmail, password: duplicateLoginAccount.password, organizationId: second.org._id.toString() });
  assert.notEqual(firstOrgLogin.user.role, 'PLATFORM_ADMIN');
  assert.notEqual(secondOrgLogin.user.role, 'PLATFORM_ADMIN');
  if (!('organizationId' in firstOrgLogin.user) || !('organizationId' in secondOrgLogin.user)) {
    throw new Error('Expected tenant login responses to include organizationId');
  }
  assert.equal(firstOrgLogin.user.organizationId.toString(), first.org._id.toString());
  assert.equal(secondOrgLogin.user.organizationId.toString(), second.org._id.toString());

  console.log('ALL PHASE 6 EMPIRICAL TESTS PASSED SUCCESSFULLY!');
  await mongoose.connection.close();
}

runTests().catch(async error => {
  console.error('Phase 6 test failed:', error);
  await mongoose.connection.close();
  process.exitCode = 1;
});