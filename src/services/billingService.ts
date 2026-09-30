import { Types } from 'mongoose';
import BillingCounter from '../models/BillingCounter';
import BillingPayment, { BillingPaymentMethod } from '../models/BillingPayment';
import BillingRecord from '../models/BillingRecord';
import Branch from '../models/Branch';
import Organization from '../models/Organization';
import OrganizationSubscription, { PAYMENT_TERM_MONTHS, PaymentTermMonths, SubscriptionStatus } from '../models/OrganizationSubscription';
import SubscriptionPlan from '../models/SubscriptionPlan';
import User, { IUser } from '../models/User';
import { XenditService } from './xenditService';
import { getProvisioning } from './organizationSeatService';

const STANDARD_PLAN = {
  name: 'DoyBiz Standard',
  code: 'STANDARD',
  setupFee: 5000,
  monthlyBranchPrice: 1499,
  includedUsersPerBranch: 3,
  additionalUserPrice: 200,
  currency: 'PHP',
  billingInterval: 'MONTHLY',
  status: 'ACTIVE',
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const organizationId = (user: IUser) => user.organizationId;

const getStandardPlan = async () => {
  const existing = await SubscriptionPlan.findOne({ code: STANDARD_PLAN.code });
  if (existing) {
    if (existing.status !== 'ACTIVE') throw new Error('Active subscription plan is unavailable');
    return existing;
  }
  try {
    return await SubscriptionPlan.create(STANDARD_PLAN);
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    const plan = await SubscriptionPlan.findOne({ code: STANDARD_PLAN.code, status: 'ACTIVE' });
    if (!plan) throw new Error('Active subscription plan is unavailable');
    return plan;
  }
};

const getActiveBranches = async (orgId: Types.ObjectId) => Branch.find({ organizationId: orgId, status: 'ACTIVE', billingActivationPending: { $ne: true } }).select('_id name billingEffectiveAt createdAt');

type BillingPeriod = { start: Date; end: Date };

const dayMilliseconds = 24 * 60 * 60 * 1000;

const normalizeDate = (value: Date | string | undefined) => {
  const date = value ? new Date(value) : new Date(0);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
};

const billingEffectiveDate = (user: IUser) => normalizeDate(user.billingEffectiveAt || user.createdAt);
const branchBillingEffectiveDate = (branch: { billingEffectiveAt?: Date; createdAt: Date }) => normalizeDate(branch.billingEffectiveAt || branch.createdAt);

const billingDays = (period: BillingPeriod) => Math.max(1, Math.ceil((period.end.getTime() - period.start.getTime()) / dayMilliseconds));

const chargedDays = (effectiveDate: Date, period: BillingPeriod) => {
  if (effectiveDate.getTime() > period.end.getTime()) return 0;
  return Math.max(1, Math.ceil((period.end.getTime() - Math.max(effectiveDate.getTime(), period.start.getTime())) / dayMilliseconds));
};

const startOfUtcDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const prorateThroughTerm = (monthlyPrice: number, effectiveDate: Date, termEnd: Date) => {
  let cursor = startOfUtcDay(effectiveDate);
  const end = startOfUtcDay(termEnd);
  let amount = 0;
  let chargedDays = 0;
  while (cursor <= end) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const segmentEnd = monthEnd < end ? monthEnd : end;
    const daysInMonth = monthEnd.getUTCDate();
    const days = Math.floor((segmentEnd.getTime() - cursor.getTime()) / dayMilliseconds) + 1;
    amount += monthlyPrice * days / daysInMonth;
    chargedDays += days;
    cursor = new Date(Date.UTC(segmentEnd.getUTCFullYear(), segmentEnd.getUTCMonth(), segmentEnd.getUTCDate() + 1));
  }
  const totalRelevantDays = effectiveDate > termEnd ? 0 : Math.max(0, Math.floor((end.getTime() - startOfUtcDay(effectiveDate).getTime()) / dayMilliseconds) + 1);
  return { amount: round(amount), chargedDays, totalRelevantDays };
};

export const calculateEstimate = async (user: IUser, period?: BillingPeriod) => {
  const [plan, branches, users] = await Promise.all([
    getStandardPlan(),
    getActiveBranches(organizationId(user)),
    User.find({ organizationId: organizationId(user), status: 'ACTIVE', billingActivationPending: { $ne: true } }),
  ]);
  if (!plan) throw new Error('Active subscription plan is unavailable');

  const activeOrganizationUsers = users.length;
  const organization = await Organization.findById(organizationId(user)).select('includedBranchCount includedUserSeats additionalUserSeatsPerBranch additionalUserSeats');
  if (!organization) throw new Error('Organization not found');
  const provisioning = getProvisioning(organization);
  const includedUserSeats = provisioning.includedUserSeats + Math.max(0, branches.length - provisioning.includedBranchCount) * provisioning.additionalUserSeatsPerBranch + provisioning.additionalUserSeats;
  const additionalUserCount = Math.max(0, activeOrganizationUsers - includedUserSeats);
  const totalDays = period ? billingDays(period) : undefined;
  const chargeableUsers = [...users]
    .sort((left, right) => billingEffectiveDate(left).getTime() - billingEffectiveDate(right).getTime())
    .slice(includedUserSeats);
  const additionalUserDetails = chargeableUsers.map(candidate => {
    const effectiveDate = billingEffectiveDate(candidate);
    const daysCharged = period ? chargedDays(effectiveDate, period) : undefined;
    const proratedAmount = period && totalDays
      ? round(plan.additionalUserPrice * (daysCharged || 0) / totalDays)
      : plan.additionalUserPrice;
    return {
      userId: candidate._id,
      daysCharged,
      totalBillingDays: totalDays,
      monthlyUnitPrice: plan.additionalUserPrice,
      proratedAmount,
      effectiveDate,
      endDate: period?.end,
    };
  });
  const additionalUserCharges = round(additionalUserDetails.reduce((total, detail) => total + detail.proratedAmount, 0));
  const breakdown = branches.map(branch => {
    const effectiveDate = branchBillingEffectiveDate(branch);
    const branchDaysCharged = period ? chargedDays(effectiveDate, period) : undefined;
    const branchCharge = period && totalDays ? round(plan.monthlyBranchPrice * (branchDaysCharged || 0) / totalDays) : plan.monthlyBranchPrice;
    return {
      branchId: branch._id,
      branchName: branch.name,
      branchCharge,
      total: branchCharge,
      branchDetails: {
        daysCharged: branchDaysCharged,
        totalBillingDays: totalDays,
        monthlyUnitPrice: plan.monthlyBranchPrice,
        proratedAmount: branchCharge,
        effectiveDate,
        endDate: period?.end,
        isProrated: period ? effectiveDate > period.start : false,
      },
    };
  });
  const monthlyBranchCharges = breakdown.reduce((total, item) => total + item.branchCharge, 0);
  return {
    plan: { id: plan._id, name: plan.name, code: plan.code, currency: plan.currency, billingInterval: plan.billingInterval },
    setupFee: plan.setupFee,
    activeOrganizationUsers,
    includedUserSeats,
    additionalUserCount,
    monthlyBranchCharges,
    additionalUserCharges,
    monthlyTotal: monthlyBranchCharges + additionalUserCharges,
    currency: plan.currency,
    breakdown,
    additionalUserDetails,
  };
};

const periodEnd = (start: Date, months = 1) => {
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return end;
};

const nextInvoiceNumber = async () => {
  const year = new Date().getUTCFullYear();
  let counter;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      counter = await BillingCounter.findOneAndUpdate({ year }, { $inc: { sequence: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
      break;
    } catch (error: any) {
      if (error?.code !== 11000 || attempt === 2) throw error;
    }
  }
  if (!counter) throw new Error('Unable to generate invoice number');
  return `INV-${year}-${String(counter.sequence).padStart(6, '0')}`;
};

const setupInvoice = async (subscription: any, plan: any) => {
  const existing = await BillingRecord.findOne({ organizationId: subscription.organizationId, billingType: 'SETUP' });
  if (existing) return existing;
  try {
    return await BillingRecord.create({
      organizationId: subscription.organizationId,
      subscriptionId: subscription._id,
      invoiceNumber: await nextInvoiceNumber(),
      billingType: 'SETUP',
      periodStart: subscription.startedAt,
      periodEnd: subscription.startedAt,
      subtotal: plan.setupFee,
      setupFee: plan.setupFee,
      branchCharges: 0,
      additionalUserCharges: 0,
      lineItems: [{ description: 'One-time setup fee', branchCharge: 0, additionalUserCharge: 0, amount: plan.setupFee }],
      totalAmount: plan.setupFee,
      currency: plan.currency,
      status: 'PENDING',
      dueDate: subscription.startedAt,
    });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    const duplicate = await BillingRecord.findOne({ organizationId: subscription.organizationId, billingType: 'SETUP' });
    if (!duplicate) throw error;
    return duplicate;
  }
};

export const getSubscription = async (user: IUser) => OrganizationSubscription.findOne({ organizationId: organizationId(user) }).populate('planId');

export const getPlan = async () => getStandardPlan();

export const activateSubscription = async (user: IUser, data: any = {}) => {
  const plan = await getStandardPlan();
  if (!plan) throw new Error('Active subscription plan is unavailable');
  const paymentTermMonths = Number(data.paymentTermMonths || 1) as PaymentTermMonths;
  if (!PAYMENT_TERM_MONTHS.includes(paymentTermMonths)) throw new Error('paymentTermMonths must be one of 1, 3, 6, or 12');
  const existing = await OrganizationSubscription.findOne({ organizationId: organizationId(user) });
  if (existing) {
    const existingTerm = existing.paymentTermMonths || 1;
    if (existingTerm !== paymentTermMonths) throw new Error('An existing subscription already has a different prepaid term');
    if (['TRIAL', 'ACTIVE'].includes(existing.status)) return { subscription: await existing.populate('planId'), setupInvoice: await setupInvoice(existing, plan) };
    throw new Error(`Cannot activate subscription from ${existing.status} status`);
  }

  const startedAt = new Date();
  const subscription = await OrganizationSubscription.create({
    organizationId: organizationId(user),
    planId: plan._id,
    paymentTermMonths,
    status: 'ACTIVE',
    startedAt,
    currentPeriodStart: startedAt,
    currentPeriodEnd: periodEnd(startedAt, paymentTermMonths),
    setupFeeStatus: 'PENDING',
    autoRenew: true,
  });
  try {
    const invoice = await setupInvoice(subscription, plan);
    return { subscription: await subscription.populate('planId'), setupInvoice: invoice };
  } catch (error) {
    await OrganizationSubscription.deleteOne({ _id: subscription._id, organizationId: organizationId(user) });
    throw error;
  }
};

export const cancelSubscription = async (user: IUser) => {
  const subscription = await OrganizationSubscription.findOne({ organizationId: organizationId(user) });
  if (!subscription) throw new Error('Subscription not found');
  if (subscription.status === 'CANCELLED') return subscription;
  subscription.status = 'CANCELLED';
  subscription.autoRenew = false;
  subscription.cancelledAt = new Date();
  return subscription.save();
};

export const getSubscriptionAccess = async (orgId: Types.ObjectId) => {
  const subscription = await OrganizationSubscription.findOne({ organizationId: orgId }).select('status currentPeriodEnd');
  if (!subscription) return { active: false, status: null as SubscriptionStatus | null, currentPeriodEnd: null };
  const active = ['TRIAL', 'ACTIVE'].includes(subscription.status) && subscription.currentPeriodEnd >= new Date();
  return { active, status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd };
};

export const generateSubscriptionInvoice = async (user: IUser) => {
  const subscription = await OrganizationSubscription.findOne({ organizationId: organizationId(user), status: { $in: ['TRIAL', 'ACTIVE'] } });
  if (!subscription) throw new Error('An active subscription is required');
  const existing = await BillingRecord.findOne({ organizationId: organizationId(user), billingType: 'SUBSCRIPTION', periodStart: subscription.currentPeriodStart, periodEnd: subscription.currentPeriodEnd });
  if (existing?.status === 'PAID' || existing?.status === 'VOID') return existing;
  const paymentTermMonths = subscription.paymentTermMonths || 1;
  const estimate = await calculateEstimate(user);
  const lineItems = [
    ...estimate.breakdown.map(item => ({
      description: item.branchName,
      branchId: item.branchId,
      daysCharged: undefined,
      totalBillingDays: undefined,
      monthlyUnitPrice: item.branchDetails.monthlyUnitPrice,
      proratedAmount: round(item.branchCharge * paymentTermMonths),
      effectiveDate: subscription.currentPeriodStart,
      endDate: subscription.currentPeriodEnd,
      isProrated: false,
      paymentTermMonths,
      branchCharge: round(item.branchCharge * paymentTermMonths),
      additionalUserCharge: 0,
      amount: round(item.branchCharge * paymentTermMonths),
    })),
    ...estimate.additionalUserDetails.map(detail => ({
      description: 'Additional organization user charge',
      userId: detail.userId,
      daysCharged: detail.daysCharged,
      totalBillingDays: detail.totalBillingDays,
      monthlyUnitPrice: detail.monthlyUnitPrice,
      proratedAmount: round(detail.proratedAmount * paymentTermMonths),
      effectiveDate: subscription.currentPeriodStart,
      endDate: subscription.currentPeriodEnd,
      activeUsers: undefined,
      includedUsers: undefined,
      additionalUsers: 1,
      branchCharge: 0,
      additionalUserCharge: round(detail.proratedAmount * paymentTermMonths),
      amount: round(detail.proratedAmount * paymentTermMonths),
      paymentTermMonths,
    })),
  ];
  const branchCharges = round(estimate.monthlyBranchCharges * paymentTermMonths);
  const additionalUserCharges = round(estimate.additionalUserCharges * paymentTermMonths);
  const totalAmount = round(branchCharges + additionalUserCharges);
  if (existing) {
    existing.paymentTermMonths = paymentTermMonths;
    existing.subtotal = totalAmount;
    existing.branchCharges = branchCharges;
    existing.additionalUserCharges = additionalUserCharges;
    existing.totalAmount = totalAmount;
    existing.lineItems = lineItems as any;
    return existing.save();
  }
  try {
    return await BillingRecord.create({
      organizationId: organizationId(user),
      subscriptionId: subscription._id,
      invoiceNumber: await nextInvoiceNumber(),
      billingType: 'SUBSCRIPTION',
      paymentTermMonths,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      subtotal: totalAmount,
      setupFee: 0,
      branchCharges,
      additionalUserCharges,
      lineItems,
      totalAmount,
      currency: estimate.currency,
      status: 'PENDING',
      dueDate: subscription.currentPeriodStart,
    });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    const duplicate = await BillingRecord.findOne({ organizationId: organizationId(user), billingType: 'SUBSCRIPTION', periodStart: subscription.currentPeriodStart, periodEnd: subscription.currentPeriodEnd });
    if (!duplicate) throw error;
    return duplicate;
  }
};

export const createMidTermAdjustment = async (user: IUser, data: any = {}) => {
  const subscription = await OrganizationSubscription.findOne({ organizationId: organizationId(user), status: { $in: ['TRIAL', 'ACTIVE'] } });
  if (!subscription) throw new Error('An active prepaid subscription is required');
  const plan = await getStandardPlan();
  const orgId = organizationId(user);
  const existing = await BillingRecord.findOne({ organizationId: orgId, subscriptionId: subscription._id, billingType: 'ADJUSTMENT', status: 'PENDING' });
  const branchIds = new Set<string>((data.branchIds || data.branches || []).map((id: string) => id.toString()));
  const userEntries = new Map<string, string | undefined>();
  for (const entry of data.users || []) userEntries.set(entry.userId.toString(), entry.branchId?.toString());
  for (const id of data.userIds || []) userEntries.set(id.toString(), data.branchId?.toString());
  for (const line of existing?.lineItems || []) {
    if (line.targetType === 'BRANCH' && line.targetId) branchIds.add(line.targetId.toString());
    if (line.targetType === 'USER' && line.targetId) userEntries.set(line.targetId.toString(), line.branchId?.toString());
  }
  if (branchIds.size === 0 && userEntries.size === 0) throw new Error('At least one branch or user addition is required');

  const branches = await Branch.find({ organizationId: orgId, _id: { $in: [...branchIds].map(id => new Types.ObjectId(id)) } }).select('_id name status billingActivationPending billingEffectiveAt createdAt');
  if (branches.length !== branchIds.size) throw new Error('One or more branches were not found in this organization');
  const users = await User.find({ organizationId: orgId, _id: { $in: [...userEntries.keys()].map(id => new Types.ObjectId(id)) } }).select('_id name status branchAccess billingActivationPending billingEffectiveAt createdAt');
  if (users.length !== userEntries.size) throw new Error('One or more users were not found in this organization');

  const assignedBranchIds = [...new Set([...userEntries.values()].filter((id): id is string => Boolean(id)))];
  if (assignedBranchIds.length > 0) {
    const assignedBranches = await Branch.countDocuments({ organizationId: orgId, _id: { $in: assignedBranchIds.map(id => new Types.ObjectId(id)) } });
    if (assignedBranches !== assignedBranchIds.length) throw new Error('One or more user branches were not found in this organization');
  }

  const activeBranches = await getActiveBranches(orgId);
  const activeBranchIds = new Set(activeBranches.map(branch => branch._id.toString()));
  const projectedBranchCount = activeBranches.length + branches.filter(branch => !activeBranchIds.has(branch._id.toString())).length;
  const requestedUserIds = users.map(candidate => candidate._id);
  const activeUsersBefore = await User.countDocuments({
    organizationId: orgId,
    status: 'ACTIVE',
    billingActivationPending: { $ne: true },
    _id: { $nin: requestedUserIds },
  });
  const organization = await Organization.findById(orgId).select('includedBranchCount includedUserSeats additionalUserSeatsPerBranch additionalUserSeats');
  if (!organization) throw new Error('Organization not found');
  const provisioning = getProvisioning(organization);
  const includedSeatsBefore = provisioning.includedUserSeats + Math.max(0, activeBranches.length - provisioning.includedBranchCount) * provisioning.additionalUserSeatsPerBranch + provisioning.additionalUserSeats;
  const includedSeatsAfter = provisioning.includedUserSeats + Math.max(0, projectedBranchCount - provisioning.includedBranchCount) * provisioning.additionalUserSeatsPerBranch + provisioning.additionalUserSeats;
  const existingAdditionalUsers = Math.max(0, activeUsersBefore - includedSeatsBefore);
  const projectedAdditionalUsers = Math.max(0, activeUsersBefore + users.length - includedSeatsAfter);
  const chargeableUserCount = Math.max(0, projectedAdditionalUsers - existingAdditionalUsers);
  const chargeableUsers = [...users]
    .sort((left, right) => billingEffectiveDate(left).getTime() - billingEffectiveDate(right).getTime())
    .slice(0, chargeableUserCount);

  const lineItems: any[] = [];
  for (const branch of branches) {
    const result = prorateThroughTerm(plan.monthlyBranchPrice, branchBillingEffectiveDate(branch), subscription.currentPeriodEnd);
    if (result.amount <= 0) throw new Error('Branch effective date must be before the subscription term end');
    lineItems.push({
      description: branch.name,
      targetType: 'BRANCH',
      targetId: branch._id,
      branchId: branch._id,
      daysCharged: result.chargedDays,
      totalBillingDays: result.totalRelevantDays,
      monthlyUnitPrice: plan.monthlyBranchPrice,
      proratedAmount: result.amount,
      effectiveDate: branchBillingEffectiveDate(branch),
      endDate: subscription.currentPeriodEnd,
      isProrated: true,
      prorationMethod: 'CALENDAR_MONTH_DAILY',
      branchCharge: result.amount,
      additionalUserCharge: 0,
      amount: result.amount,
      paymentTermMonths: subscription.paymentTermMonths || 1,
    });
  }
  for (const candidate of chargeableUsers) {
    const branchId = userEntries.get(candidate._id.toString());
    const result = prorateThroughTerm(plan.additionalUserPrice, billingEffectiveDate(candidate), subscription.currentPeriodEnd);
    if (result.amount <= 0) throw new Error('User effective date must be before the subscription term end');
    lineItems.push({
      description: 'Additional user charge',
      targetType: 'USER',
      targetId: candidate._id,
      userId: candidate._id,
      ...(branchId ? { branchId: new Types.ObjectId(branchId) } : {}),
      daysCharged: result.chargedDays,
      totalBillingDays: result.totalRelevantDays,
      monthlyUnitPrice: plan.additionalUserPrice,
      proratedAmount: result.amount,
      effectiveDate: billingEffectiveDate(candidate),
      endDate: subscription.currentPeriodEnd,
      isProrated: true,
      prorationMethod: 'CALENDAR_MONTH_DAILY',
      branchCharge: 0,
      additionalUserCharge: result.amount,
      amount: result.amount,
      paymentTermMonths: subscription.paymentTermMonths || 1,
    });
  }
  await Branch.updateMany({ organizationId: orgId, _id: { $in: branches.map(branch => branch._id) } }, { $set: { status: 'INACTIVE', billingActivationPending: true } });
  const chargeableUserIds = chargeableUsers.map(candidate => candidate._id);
  if (branches.length === 0 && chargeableUsers.length === 0) throw new Error('No additional billing is required for these organization additions');
  if (chargeableUserIds.length > 0) await User.updateMany({ organizationId: orgId, _id: { $in: chargeableUserIds } }, { $set: { status: 'INACTIVE', billingActivationPending: true } });
  const branchCharges = round(lineItems.filter(item => item.targetType === 'BRANCH').reduce((sum, item) => sum + item.amount, 0));
  const additionalUserCharges = round(lineItems.filter(item => item.targetType === 'USER').reduce((sum, item) => sum + item.amount, 0));
  const totalAmount = round(branchCharges + additionalUserCharges);
  if (existing) {
    existing.subtotal = totalAmount;
    existing.branchCharges = branchCharges;
    existing.additionalUserCharges = additionalUserCharges;
    existing.totalAmount = totalAmount;
    existing.lineItems = lineItems;
    existing.coverageStart = subscription.currentPeriodStart;
    existing.coverageEnd = subscription.currentPeriodEnd;
    return existing.save();
  }
  return BillingRecord.create({
    organizationId: orgId,
    subscriptionId: subscription._id,
    invoiceNumber: await nextInvoiceNumber(),
    billingType: 'ADJUSTMENT',
    paymentTermMonths: subscription.paymentTermMonths || 1,
    periodStart: new Date(),
    periodEnd: subscription.currentPeriodEnd,
    coverageStart: subscription.currentPeriodStart,
    coverageEnd: subscription.currentPeriodEnd,
    subtotal: totalAmount,
    setupFee: 0,
    branchCharges,
    additionalUserCharges,
    lineItems,
    totalAmount,
    currency: plan.currency,
    status: 'PENDING',
    dueDate: new Date(),
  });
};

export const getBillingRecords = async (user: IUser) => BillingRecord.find({ organizationId: organizationId(user) }).sort({ createdAt: -1 });

export const getBillingRecord = async (id: string, user: IUser) => {
  if (!Types.ObjectId.isValid(id)) throw new Error('Invalid billing record ID format');
  const record = await BillingRecord.findOne({ _id: new Types.ObjectId(id), organizationId: organizationId(user) }).populate('subscriptionId');
  if (!record) throw new Error('Billing record not found');
  const payments = await BillingPayment.find({ organizationId: organizationId(user), billingRecordId: record._id, status: 'COMPLETED' }).sort({ paidAt: 1 });
  const paidAmount = round(payments.reduce((total, payment) => total + payment.amount, 0));
  return { record, payments, paidAmount, outstandingAmount: round(record.totalAmount - paidAmount) };
};

export const recordBillingPayment = async (id: string, data: any, user: IUser) => {
  const details = await getBillingRecord(id, user);
  const idempotencyKey = typeof data.idempotencyKey === 'string' ? data.idempotencyKey.trim() : '';
  if (!idempotencyKey) throw new Error('idempotencyKey is required for billing payments');
  const previousPayment = await BillingPayment.findOne({ organizationId: organizationId(user), billingRecordId: details.record._id, idempotencyKey });
  if (previousPayment) return { payment: previousPayment, record: details.record, paidAmount: details.paidAmount, outstandingAmount: details.outstandingAmount };
  if (details.record.status === 'PAID' || details.record.status === 'VOID') throw new Error('This billing record cannot accept payments');
  const amount = round(Number(data.amount));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than 0');
  if (amount > details.outstandingAmount) throw new Error(`Payment exceeds outstanding balance of ${details.outstandingAmount.toFixed(2)}`);
  const paymentMethod = data.paymentMethod as BillingPaymentMethod;
  if (!['CASH', 'GCASH', 'BANK_TRANSFER', 'CARD', 'OTHER'].includes(paymentMethod)) throw new Error('Invalid billing payment method');
  const payment = await BillingPayment.create({ organizationId: organizationId(user), billingRecordId: details.record._id, amount, paymentMethod, referenceNumber: data.referenceNumber, idempotencyKey, status: 'COMPLETED', paidAt: data.paidAt ? new Date(data.paidAt) : new Date(), receivedBy: user._id });
  const paidAmount = round(details.paidAmount + amount);
  const status = paidAmount >= details.record.totalAmount ? 'PAID' : details.record.status;
  const record = await BillingRecord.findOneAndUpdate({ _id: details.record._id, organizationId: organizationId(user), status: { $in: ['PENDING', 'OVERDUE'] } }, { $set: { status, ...(status === 'PAID' ? { paidAt: new Date() } : {}) } }, { new: true });
  if (!record) {
    await BillingPayment.deleteOne({ _id: payment._id, organizationId: organizationId(user), status: 'COMPLETED' });
    throw new Error('Billing record changed while recording payment; please retry');
  }
  if (record.billingType === 'SETUP' && status === 'PAID') await OrganizationSubscription.updateOne({ _id: record.subscriptionId, organizationId: organizationId(user) }, { $set: { setupFeeStatus: 'PAID', setupFeePaidAt: new Date() } });
  if (record.billingType === 'ADJUSTMENT' && status === 'PAID') {
    const branchIds = record.lineItems.filter(item => item.targetType === 'BRANCH' && item.targetId).map(item => item.targetId);
    const userIds = record.lineItems.filter(item => item.targetType === 'USER' && item.targetId).map(item => item.targetId);
    if (branchIds.length > 0) await Branch.updateMany({ organizationId: organizationId(user), _id: { $in: branchIds } }, { $set: { status: 'ACTIVE', billingActivationPending: false } });
    if (userIds.length > 0) await User.updateMany({ organizationId: organizationId(user), _id: { $in: userIds } }, { $set: { status: 'ACTIVE', billingActivationPending: false } });
  }
  return { payment, record, paidAmount, outstandingAmount: round(record.totalAmount - paidAmount) };
};

export const getBillingPayments = async (id: string, user: IUser) => (await getBillingRecord(id, user)).payments;

export const reconcileXenditWebhook = async (payload: any, headers: Record<string, any> = {}) => {
  const xendit = new XenditService(process.env.XENDIT_SECRET_KEY, process.env.XENDIT_BASE_URL, process.env.XENDIT_WEBHOOK_TOKEN);
  xendit.verifyWebhookToken(headers);

  const eventName = String(payload?.event || '').trim();
  const eventStatus = String(payload?.data?.status || payload?.status || '').trim().toUpperCase();
  if (!['payment_request.succeeded', 'payment_request.failed'].includes(eventName) && eventStatus !== 'SUCCEEDED' && eventStatus !== 'FAILED') {
    throw new Error('Unsupported Xendit webhook event');
  }

  if (eventName === 'payment_request.failed' || eventStatus === 'FAILED') {
    throw new Error('Xendit payment failure is not a successful reconciliation event');
  }

  const providerId = String(payload?.data?.id || '').trim();
  const referenceId = String(payload?.data?.reference_id || payload?.data?.referenceId || '').trim();
  const amount = Number(payload?.data?.amount ?? payload?.amount ?? 0);
  const currency = String(payload?.data?.currency || payload?.currency || '').trim().toUpperCase();
  const metadata = payload?.data?.metadata || payload?.metadata || {};
  const billingRecordId = metadata.billingRecordId || (referenceId.startsWith('BILLING-') ? referenceId.replace(/^BILLING-/, '') : null);

  if (!providerId) throw new Error('Xendit webhook payload is missing the payment request ID');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Webhook amount is invalid');
  if (!billingRecordId) throw new Error('Webhook metadata is missing the billingRecordId');

  const payment = await BillingPayment.findOne({ providerName: 'XENDIT', providerPaymentRequestId: providerId }).sort({ createdAt: -1 });
  if (!payment) throw new Error('No matching billing payment was found for this Xendit payment request');

  const record = await BillingRecord.findOne({ _id: new Types.ObjectId(billingRecordId), organizationId: payment.organizationId });
  if (!record) throw new Error('Billing record for Xendit webhook payment could not be found');

  if (payment.status === 'COMPLETED') {
    return { payment, record, paidAmount: payment.amount, outstandingAmount: round(Math.max(record.totalAmount - payment.amount, 0)) };
  }

  if (payment.amount !== round(amount)) {
    throw new Error('Webhook amount does not match the internal billing record amount');
  }
  if (record.currency && currency && record.currency !== currency) {
    throw new Error('Webhook currency does not match the billing record currency');
  }
  if (record.totalAmount !== round(payment.amount)) {
    throw new Error('Webhook amount does not match the outstanding billing total');
  }

  const paymentUpdate = await BillingPayment.findOneAndUpdate(
    { _id: payment._id, organizationId: payment.organizationId, status: { $ne: 'COMPLETED' } },
    {
      $set: {
        status: 'COMPLETED',
        providerStatus: eventStatus || payment.providerStatus,
        providerReferenceId: referenceId || payment.providerReferenceId,
        providerData: payload.data || payment.providerData,
        paidAt: new Date(),
      },
    },
    { new: true }
  );

  if (!paymentUpdate) {
    throw new Error('Billing payment has already been reconciled');
  }

  const updatedRecord = await BillingRecord.findOneAndUpdate(
    { _id: record._id, organizationId: payment.organizationId, status: { $in: ['PENDING', 'OVERDUE'] } },
    { $set: { status: 'PAID', paidAt: new Date() } },
    { new: true }
  );

  if (!updatedRecord) {
    await BillingPayment.updateOne({ _id: payment._id }, { $set: { status: payment.status } });
    throw new Error('Billing record changed while reconciling payment; please retry');
  }

  if (updatedRecord.billingType === 'SETUP') {
    await OrganizationSubscription.updateOne({ _id: updatedRecord.subscriptionId, organizationId: payment.organizationId }, { $set: { setupFeeStatus: 'PAID', setupFeePaidAt: new Date() } });
  }
  if (updatedRecord.billingType === 'ADJUSTMENT') {
    const branchIds = updatedRecord.lineItems.filter(item => item.targetType === 'BRANCH' && item.targetId).map(item => item.targetId);
    const userIds = updatedRecord.lineItems.filter(item => item.targetType === 'USER' && item.targetId).map(item => item.targetId);
    if (branchIds.length > 0) await Branch.updateMany({ organizationId: payment.organizationId, _id: { $in: branchIds } }, { $set: { status: 'ACTIVE', billingActivationPending: false } });
    if (userIds.length > 0) await User.updateMany({ organizationId: payment.organizationId, _id: { $in: userIds } }, { $set: { status: 'ACTIVE', billingActivationPending: false } });
  }

  return { payment: paymentUpdate, record: updatedRecord, paidAmount: paymentUpdate.amount, outstandingAmount: round(Math.max(updatedRecord.totalAmount - paymentUpdate.amount, 0)) };
};

export const createXenditPaymentRequest = async (id: string, user: IUser, data: any = {}) => {
  const record = await BillingRecord.findOne({ _id: new Types.ObjectId(id), organizationId: organizationId(user) });
  if (!record) throw new Error('Billing record not found');
  if (record.status === 'PAID' || record.status === 'VOID') throw new Error('This billing record cannot accept payment requests');

  const existingPayment = await BillingPayment.findOne({
    organizationId: organizationId(user),
    billingRecordId: record._id,
    providerName: 'XENDIT',
    status: 'PENDING',
  }).sort({ createdAt: -1 });

  if (existingPayment) {
    return {
      record,
      payment: existingPayment,
      xenditPayment: {
        id: existingPayment.providerPaymentRequestId,
        status: existingPayment.providerStatus,
        reference_id: existingPayment.providerReferenceId,
        amount: existingPayment.amount,
        currency: record.currency,
        actions: existingPayment.providerData?.actions || [],
      },
    };
  }

  const xendit = new XenditService(process.env.XENDIT_SECRET_KEY, process.env.XENDIT_BASE_URL);
  if (!xendit.isConfigured()) throw new Error('XENDIT_SECRET_KEY is not configured');

  const amount = round(Number(record.totalAmount));
  const referenceId = `BILLING-${record._id.toString()}`;
  const providerInput = {
    amount,
    currency: record.currency || 'PHP',
    country: 'PH',
    referenceId,
    description: record.billingType === 'ADJUSTMENT' ? 'Mid-term billing adjustment' : 'Prepaid subscription billing',
    metadata: {
      organizationId: organizationId(user).toString(),
      billingRecordId: record._id.toString(),
      billingType: record.billingType,
    },
    ...(data.paymentMethod ? { paymentMethod: data.paymentMethod } : {}),
  };

  const providerResponse = await xendit.createPaymentRequest(providerInput);
  const payment = await BillingPayment.create({
    organizationId: organizationId(user),
    billingRecordId: record._id,
    amount,
    paymentMethod: 'OTHER',
    referenceNumber: providerResponse.reference_id || referenceId,
    idempotencyKey: `xendit-${record._id.toString()}-${providerResponse.id}`,
    status: 'PENDING',
    providerName: 'XENDIT',
    providerPaymentRequestId: providerResponse.id,
    providerReferenceId: providerResponse.reference_id || referenceId,
    providerStatus: providerResponse.status,
    providerData: providerResponse,
    paidAt: new Date(),
    receivedBy: user._id,
  });

  return {
    record,
    payment,
    xenditPayment: {
      id: providerResponse.id,
      status: providerResponse.status,
      reference_id: providerResponse.reference_id || referenceId,
      amount,
      currency: record.currency || 'PHP',
      actions: providerResponse.actions || [],
    },
  };
};