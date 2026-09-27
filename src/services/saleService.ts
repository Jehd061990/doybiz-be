import { Types } from 'mongoose';
import Branch from '../models/Branch';
import Customer from '../models/Customer';
import Organization from '../models/Organization';
import Reservation from '../models/Reservation';
import Sale, { ISale, PaymentStatus, SaleStatus } from '../models/Sale';
import SaleCounter from '../models/SaleCounter';
import SaleItem from '../models/SaleItem';
import Service from '../models/Service';
import User from '../models/User';
import Payment from '../models/Payment';
import { IUser } from '../models/User';
import { canAccessBranch } from '../utils/branchAccess';

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const numericMoney = (value: unknown, field: string, defaultValue = 0) => {
  const numberValue = value === undefined ? defaultValue : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) throw new Error(`${field} must be a non-negative number`);
  return roundMoney(numberValue);
};

const requireObjectId = (value: string, field: string) => {
  if (!Types.ObjectId.isValid(value)) throw new Error(`Invalid ${field} format`);
  return new Types.ObjectId(value);
};

const getBranch = async (branchId: string, organizationId: string, user: IUser) => {
  const branch = await Branch.findOne({
    _id: requireObjectId(branchId, 'branch ID'),
    organizationId: requireObjectId(organizationId, 'organization ID'),
    status: 'ACTIVE',
  });
  if (!branch) throw new Error('Branch not found or inactive');
  if (!canAccessBranch(user, branch._id)) throw new Error('You do not have access to this branch');
  return branch;
};

const createSaleNumber = async (organizationId: Types.ObjectId, branchId: Types.ObjectId) => {
  const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let counter;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      counter = await SaleCounter.findOneAndUpdate(
        { organizationId, branchId, dateKey },
        { $inc: { sequence: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      break;
    } catch (error: any) {
      if (error?.code !== 11000 || attempt === 2) throw error;
    }
  }
  if (!counter) throw new Error('Unable to generate sale number');
  return `SALE-${dateKey}-${branchId.toString().slice(-4).toUpperCase()}-${String(counter.sequence).padStart(4, '0')}`;
};

const prepareItems = async (items: any[], organizationId: Types.ObjectId, branchId: Types.ObjectId) => {
  if (!Array.isArray(items) || items.length === 0) throw new Error('At least one sale item is required');

  const prepared = [];
  for (const item of items) {
    const itemType = item.itemType || 'SERVICE';
    if (itemType !== 'SERVICE') throw new Error(`Unsupported sale item type: ${itemType}`);
    const referenceId = item.referenceId || item.serviceId;
    if (!referenceId || !Types.ObjectId.isValid(referenceId)) throw new Error('A valid service ID is required for each item');

    const service = await Service.findOne({
      _id: new Types.ObjectId(referenceId),
      organizationId,
      status: 'ACTIVE',
    });
    if (!service) throw new Error('Service not found or inactive');
    if (service.branchId && service.branchId.toString() !== branchId.toString()) {
      throw new Error('Service is not available at the selected branch');
    }

    const quantity = Number(item.quantity === undefined ? 1 : item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Item quantity must be greater than 0');
    const unitPrice = roundMoney(service.price);
    const subtotal = roundMoney(quantity * unitPrice);
    const discount = numericMoney(item.discount, 'Item discount');
    if (discount > subtotal) throw new Error('Item discount cannot exceed item subtotal');

    prepared.push({
      organizationId,
      branchId,
      itemType,
      referenceId: service._id,
      name: service.name,
      quantity,
      unitPrice,
      discount,
      subtotal,
      total: roundMoney(subtotal - discount),
      durationMinutes: service.durationMinutes,
      metadata: item.metadata,
    });
  }
  return prepared;
};

const createSaleRecords = async (data: any, organizationId: string, user: IUser) => {
  const organizationObjectId = requireObjectId(organizationId, 'organization ID');
  const branch = await getBranch(data.branchId, organizationId, user);
  let customerId: Types.ObjectId | undefined;
  if (data.customerId) {
    customerId = requireObjectId(data.customerId, 'customer ID');
    const customer = await Customer.findOne({ _id: customerId, organizationId: organizationObjectId, status: 'ACTIVE' });
    if (!customer) throw new Error('Customer not found or inactive');
  }

  const preparedItems = await prepareItems(data.items, organizationObjectId, branch._id);
  const subtotal = roundMoney(preparedItems.reduce((sum, item) => sum + item.subtotal, 0));
  const itemDiscount = roundMoney(preparedItems.reduce((sum, item) => sum + item.discount, 0));
  const discount = numericMoney(data.discount, 'Discount');
  const tax = numericMoney(data.tax, 'Tax');
  const total = roundMoney(Math.max(0, subtotal - itemDiscount - discount) + tax);
  const saleNumber = await createSaleNumber(organizationObjectId, branch._id);

  const sale = await Sale.create({
    organizationId: organizationObjectId,
    branchId: branch._id,
    customerId,
    reservationId: data.reservationId ? requireObjectId(data.reservationId, 'reservation ID') : undefined,
    cashierId: user._id,
    createdBy: user._id,
    saleNumber,
    subtotal,
    discount: roundMoney(discount + itemDiscount),
    tax,
    total,
    amountPaid: 0,
    change: 0,
    paymentStatus: 'UNPAID',
    status: 'COMPLETED',
    notes: data.notes,
  });

  try {
    await SaleItem.insertMany(preparedItems.map(item => ({ ...item, saleId: sale._id })));
  } catch (error) {
    await Sale.deleteOne({ _id: sale._id, organizationId: organizationObjectId });
    throw error;
  }
  return sale;
};

export const createSale = async (data: any, organizationId: string, user: IUser) => {
  return (await createSaleRecords(data, organizationId, user)).populate(['branchId', 'customerId', 'cashierId']);
};

export const createSaleFromReservation = async (reservationId: string, organizationId: string, user: IUser) => {
  const reservationObjectId = requireObjectId(reservationId, 'reservation ID');
  const organizationObjectId = requireObjectId(organizationId, 'organization ID');
  const reservation = await Reservation.findOne({ _id: reservationObjectId, organizationId: organizationObjectId });
  if (!reservation) throw new Error('Reservation not found');
  if (!canAccessBranch(user, reservation.branchId)) throw new Error('You do not have access to this reservation branch');
  if (reservation.status !== 'COMPLETED') throw new Error('Only completed reservations can be converted into sales');
  const duplicate = await Sale.findOne({ organizationId: organizationObjectId, reservationId: reservation._id, status: { $ne: 'VOIDED' } });
  if (duplicate) throw new Error('Reservation has already been converted into a sale');

  return createSale({
    branchId: reservation.branchId.toString(),
    customerId: reservation.customerId.toString(),
    reservationId: reservation._id.toString(),
    items: [{ itemType: 'SERVICE', referenceId: reservation.serviceId.toString(), quantity: 1 }],
    notes: reservation.notes,
  }, organizationId, user);
};

const saleQuery = (id: string, organizationId: string) => ({
  _id: requireObjectId(id, 'sale ID'),
  organizationId: requireObjectId(organizationId, 'organization ID'),
});

export const getSaleById = async (id: string, organizationId: string, user: IUser) => {
  const sale = await Sale.findOne(saleQuery(id, organizationId))
    .populate('branchId', 'name address contactNumber')
    .populate('customerId', 'firstName lastName phone email')
    .populate('cashierId', 'name email role');
  if (!sale) throw new Error('Sale not found');
  if (!canAccessBranch(user, sale.branchId)) throw new Error('You do not have access to this sale branch');
  const items = await SaleItem.find({ organizationId: sale.organizationId, saleId: sale._id });
  return { sale, items };
};

export const getSales = async (organizationId: string, queryParams: any, user: IUser) => {
  const organizationObjectId = requireObjectId(organizationId, 'organization ID');
  const query: any = { organizationId: organizationObjectId };
  if (queryParams.branchId) {
    await getBranch(queryParams.branchId, organizationId, user);
    query.branchId = requireObjectId(queryParams.branchId, 'branch ID');
  } else if (user.role !== 'OWNER' && user.branchAccess !== 'ALL') {
    query.branchId = { $in: (Array.isArray(user.branchAccess) ? user.branchAccess : []).map(branch => new Types.ObjectId(branch)) };
  }
  for (const field of ['customerId', 'cashierId']) {
    if (queryParams[field]) query[field] = requireObjectId(queryParams[field], `${field} ID`);
  }
  if (queryParams.status) query.status = queryParams.status as SaleStatus;
  if (queryParams.paymentStatus) query.paymentStatus = queryParams.paymentStatus as PaymentStatus;
  if (queryParams.date) {
    const start = new Date(`${queryParams.date}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) throw new Error('Invalid date filter');
    query.createdAt = { $gte: start, $lt: new Date(start.getTime() + 86400000) };
  } else if (queryParams.startDate || queryParams.endDate) {
    query.createdAt = {};
    if (queryParams.startDate) query.createdAt.$gte = new Date(`${queryParams.startDate}T00:00:00.000Z`);
    if (queryParams.endDate) query.createdAt.$lt = new Date(`${queryParams.endDate}T23:59:59.999Z`);
  }
  if (queryParams.search) {
    const regex = new RegExp(String(queryParams.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const customers = await Customer.find({ organizationId: organizationObjectId, $or: [{ firstName: regex }, { lastName: regex }, { phone: regex }] }).select('_id');
    query.$or = [{ saleNumber: regex }, { customerId: { $in: customers.map(customer => customer._id) } }];
  }
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '10', 10)));
  const [data, total] = await Promise.all([
    Sale.find(query).populate('branchId', 'name address').populate('customerId', 'firstName lastName phone').populate('cashierId', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Sale.countDocuments(query),
  ]);
  return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } };
};

export const updateSale = async (id: string, data: any, organizationId: string, user: IUser) => {
  const existing = await Sale.findOne(saleQuery(id, organizationId));
  if (!existing) throw new Error('Sale not found');
  if (!canAccessBranch(user, existing.branchId)) throw new Error('You do not have access to this sale branch');
  if (existing.status !== 'DRAFT') throw new Error('Completed financial sales cannot be edited');
  existing.notes = data.notes !== undefined ? data.notes : existing.notes;
  existing.updatedBy = user._id;
  return existing.save();
};

export const voidSale = async (id: string, reason: string | undefined, organizationId: string, user: IUser) => {
  const sale = await Sale.findOne(saleQuery(id, organizationId));
  if (!sale) throw new Error('Sale not found');
  if (!canAccessBranch(user, sale.branchId)) throw new Error('You do not have access to this sale branch');
  if (sale.status !== 'COMPLETED') throw new Error('Only completed sales can be voided');
  sale.status = 'VOIDED';
  sale.voidedBy = user._id;
  sale.voidedAt = new Date();
  sale.voidReason = reason;
  return sale.save();
};

export const deleteSale = async (id: string, organizationId: string, user: IUser) => {
  const sale = await voidSale(id, 'Voided through delete endpoint', organizationId, user);
  return { message: 'Sale voided successfully; completed financial records are not physically deleted', sale };
};

export const getReceipt = async (id: string, organizationId: string, user: IUser) => {
  const result = await getSaleById(id, organizationId, user);
  const payments = await Payment.find({ organizationId: result.sale.organizationId, saleId: result.sale._id, status: 'COMPLETED' }).populate('receivedBy', 'name');
  const organization = await Organization.findById(result.sale.organizationId).select('name email phone address');
  const branch = await Branch.findById(result.sale.branchId).select('name address contactNumber');
  const cashier = await User.findById(result.sale.cashierId).select('name email role');
  const customer = result.sale.customerId ? await Customer.findById(result.sale.customerId).select('firstName lastName phone email') : null;
  return { business: organization, branch, sale: result.sale, cashier, customer, items: result.items, payments };
};