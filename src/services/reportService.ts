import { Types } from 'mongoose';
import Branch from '../models/Branch';
import Customer from '../models/Customer';
import Payment from '../models/Payment';
import Reservation from '../models/Reservation';
import Sale from '../models/Sale';
import SaleItem from '../models/SaleItem';
import User, { IUser } from '../models/User';
import { canAccessBranch, getAllowedBranchIds } from '../utils/branchAccess';

const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || 'Asia/Manila';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
type ReservationSummary = Record<'pending' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show', number> & { dateRange: { startDate: string; endDate: string } };

type DateRange = { start: Date; end: Date; startDate: string; endDate: string };

const parseDate = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) throw new Error(`${field} must use YYYY-MM-DD format`);
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`${field} is not a valid date`);
  }
  return value;
};

const localDateToUtc = (value: string, endOfDay = false) => {
  const [year, month, day] = value.split('-').map(Number);
  // The project has no timezone abstraction; Philippines business dates are UTC+08:00.
  return new Date(Date.UTC(year, month - 1, day, endOfDay ? 15 : -8, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0));
};

const formatDate = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayInBusinessTimezone = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const addCalendarDays = (value: string, days: number) => {
  const [year, month, day] = value.split('-').map(Number);
  return formatDate(new Date(Date.UTC(year, month - 1, day + days)));
};

export const resolveDateRange = (query: any = {}): DateRange => {
  const today = todayInBusinessTimezone();
  const startDate = query.startDate ? parseDate(query.startDate, 'startDate') : today;
  const endDate = query.endDate ? parseDate(query.endDate, 'endDate') : startDate;
  if (startDate > endDate) throw new Error('startDate must be before or equal to endDate');
  return { start: localDateToUtc(startDate), end: localDateToUtc(endDate, true), startDate, endDate };
};

const dateMatch = (field: string, range: DateRange) => ({ [field]: { $gte: range.start, $lte: range.end } });

const organizationId = (user: IUser) => user.organizationId;

const branchMatch = async (user: IUser, branchId?: string) => {
  if (branchId) {
    if (!Types.ObjectId.isValid(branchId)) throw new Error('Invalid branch ID format');
    const branchObjectId = new Types.ObjectId(branchId);
    const branch = await Branch.findOne({ _id: branchObjectId, organizationId: organizationId(user) });
    if (!branch) throw new Error('Branch not found in this organization');
    if (!canAccessBranch(user, branchObjectId)) throw new Error('You do not have access to this branch');
    return branchObjectId;
  }
  const allowed = getAllowedBranchIds(user);
  return allowed === 'ALL' ? undefined : { $in: allowed.map(id => new Types.ObjectId(id)) };
};

const saleMatch = async (user: IUser, query: any = {}, range?: DateRange) => {
  const branch = await branchMatch(user, query.branchId);
  return {
    organizationId: organizationId(user),
    status: 'COMPLETED',
    ...(range ? dateMatch('createdAt', range) : {}),
    ...(branch === undefined ? {} : { branchId: branch }),
  };
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const getSalesSummary = async (user: IUser, query: any = {}) => {
  const range = resolveDateRange(query);
  const match = await saleMatch(user, query, range);
  const [result] = await Sale.aggregate([
    { $match: match },
    { $group: {
      _id: null,
      grossSales: { $sum: '$subtotal' },
      discounts: { $sum: '$discount' },
      tax: { $sum: '$tax' },
      netSales: { $sum: '$total' },
      amountPaid: { $sum: '$amountPaid' },
      salesCount: { $sum: 1 },
    } },
  ]);
  const data = result || { grossSales: 0, discounts: 0, tax: 0, netSales: 0, amountPaid: 0, salesCount: 0 };
  return {
    grossSales: round(data.grossSales), discounts: round(data.discounts), tax: round(data.tax), netSales: round(data.netSales),
    amountPaid: round(data.amountPaid), unpaidAmount: round(data.netSales - data.amountPaid), salesCount: data.salesCount,
    averageSale: data.salesCount ? round(data.netSales / data.salesCount) : 0,
    dateRange: { startDate: range.startDate, endDate: range.endDate },
  };
};

const groupedSales = async (user: IUser, query: any, format: string) => {
  const range = resolveDateRange(query);
  const match = await saleMatch(user, query, range);
  return Sale.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format, date: '$createdAt', timezone: BUSINESS_TIMEZONE } }, salesCount: { $sum: 1 }, totalSales: { $sum: '$total' } } },
    { $project: { _id: 0, date: '$_id', month: '$_id', salesCount: 1, totalSales: { $round: ['$totalSales', 2] } } },
    { $sort: { _id: 1, date: 1, month: 1 } },
  ]);
};

export const getDailySales = async (user: IUser, query: any = {}) => (await groupedSales(user, query, '%Y-%m-%d')).map(row => ({ date: row.date, salesCount: row.salesCount, totalSales: row.totalSales }));

export const getMonthlySales = async (user: IUser, query: any = {}) => (await groupedSales(user, query, '%Y-%m')).map(row => ({ month: row.month, salesCount: row.salesCount, totalSales: row.totalSales }));

export const getSalesByBranch = async (user: IUser, query: any = {}) => {
  const range = resolveDateRange(query);
  const match = await saleMatch(user, query, range);
  return Sale.aggregate([
    { $match: match },
    { $group: { _id: '$branchId', salesCount: { $sum: 1 }, totalSales: { $sum: '$total' } } },
    { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'branch' } },
    { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, branchId: '$_id', branchName: { $ifNull: ['$branch.name', 'Unknown'] }, salesCount: 1, totalSales: { $round: ['$totalSales', 2] } } },
    { $sort: { totalSales: -1 } },
  ]);
};

export const getSalesByService = async (user: IUser, query: any = {}) => {
  const range = resolveDateRange(query);
  const match = await saleMatch(user, query, range);
  return SaleItem.aggregate([
    { $match: { organizationId: organizationId(user), itemType: 'SERVICE' } },
    { $lookup: { from: 'sales', localField: 'saleId', foreignField: '_id', as: 'sale' } },
    { $unwind: '$sale' },
    { $match: { 'sale.organizationId': organizationId(user), 'sale.status': 'COMPLETED', ...dateMatch('sale.createdAt', range), ...(match.branchId ? { 'sale.branchId': match.branchId } : {}) } },
    { $group: { _id: { serviceId: '$referenceId', serviceName: '$name' }, quantity: { $sum: '$quantity' }, totalSales: { $sum: '$total' } } },
    { $project: { _id: 0, serviceId: '$_id.serviceId', serviceName: '$_id.serviceName', quantity: 1, totalSales: { $round: ['$totalSales', 2] } } },
    { $sort: { totalSales: -1 } },
  ]);
};

export const getSalesByCashier = async (user: IUser, query: any = {}) => {
  const range = resolveDateRange(query);
  const match = await saleMatch(user, query, range);
  return Sale.aggregate([
    { $match: match },
    { $group: { _id: '$cashierId', salesCount: { $sum: 1 }, totalSales: { $sum: '$total' } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'cashier' } },
    { $unwind: { path: '$cashier', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, cashierId: '$_id', cashierName: { $ifNull: ['$cashier.name', 'Unknown'] }, salesCount: 1, totalSales: { $round: ['$totalSales', 2] } } },
    { $sort: { totalSales: -1 } },
  ]);
};

const paymentBranchMatch = async (user: IUser, query: any) => {
  const branch = await branchMatch(user, query.branchId);
  return branch === undefined ? {} : { branchId: branch };
};

export const getPaymentsByMethod = async (user: IUser, query: any = {}) => {
  const range = resolveDateRange(query);
  const branches = await paymentBranchMatch(user, query);
  return Payment.aggregate([
    { $match: { organizationId: organizationId(user), status: 'COMPLETED', ...dateMatch('paidAt', range), ...branches } },
    { $group: { _id: '$paymentMethod', transactionCount: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
    { $project: { _id: 0, paymentMethod: '$_id', transactionCount: 1, totalAmount: { $round: ['$totalAmount', 2] } } },
    { $sort: { totalAmount: -1 } },
  ]);
};

export const getPaymentSummary = async (user: IUser, query: any = {}) => {
  const range = resolveDateRange(query);
  const match = await saleMatch(user, query, range);
  const result = await Sale.aggregate([
    { $match: match },
    { $group: { _id: '$paymentStatus', salesCount: { $sum: 1 }, totalAmount: { $sum: '$total' }, amountPaid: { $sum: '$amountPaid' } } },
  ]);
  const grouped: Record<string, any> = {};
  for (const row of result || []) grouped[row._id] = { salesCount: row.salesCount, totalAmount: round(row.totalAmount), amountPaid: round(row.amountPaid), outstandingAmount: round(row.totalAmount - row.amountPaid) };
  return { UNPAID: grouped.UNPAID || { salesCount: 0, totalAmount: 0, amountPaid: 0, outstandingAmount: 0 }, PARTIALLY_PAID: grouped.PARTIALLY_PAID || { salesCount: 0, totalAmount: 0, amountPaid: 0, outstandingAmount: 0 }, PAID: grouped.PAID || { salesCount: 0, totalAmount: 0, amountPaid: 0, outstandingAmount: 0 }, dateRange: { startDate: range.startDate, endDate: range.endDate } };
};

const reservationBranchMatch = async (user: IUser, query: any) => {
  const branch = await branchMatch(user, query.branchId);
  return branch === undefined ? {} : { branchId: branch };
};

export const getReservationSummary = async (user: IUser, query: any = {}): Promise<ReservationSummary> => {
  const range = resolveDateRange(query);
  const branch = await reservationBranchMatch(user, query);
  const rows = await Reservation.aggregate([
    { $match: { organizationId: organizationId(user), ...branch, appointmentDate: { $gte: range.startDate, $lte: range.endDate } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const summary: Record<string, number> = {};
  for (const status of RESERVATION_STATUSES) summary[status.toLowerCase()] = 0;
  for (const row of rows) summary[row._id.toLowerCase()] = row.count;
  return { ...(summary as ReservationSummary), dateRange: { startDate: range.startDate, endDate: range.endDate } };
};

const accessibleCustomerIds = async (user: IUser, query: any) => {
  const branch = await branchMatch(user, query.branchId);
  if (branch === undefined) return undefined;
  const [sales, reservations] = await Promise.all([
    Sale.distinct('customerId', { organizationId: organizationId(user), branchId: branch }),
    Reservation.distinct('customerId', { organizationId: organizationId(user), branchId: branch }),
  ]);
  return [...new Set([...sales, ...reservations].map(id => id.toString()))].map(id => new Types.ObjectId(id));
};

export const getCustomerSummary = async (user: IUser, query: any = {}) => {
  const range = resolveDateRange(query);
  const ids = await accessibleCustomerIds(user, query);
  const match: any = { organizationId: organizationId(user), ...(ids ? { _id: { $in: ids } } : {}) };
  const [result] = await Customer.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalCustomers: { $sum: 1 },
        activeCustomers: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } },
        inactiveCustomers: { $sum: { $cond: [{ $eq: ['$status', 'INACTIVE'] }, 1, 0] } },
        newCustomers: {
          $sum: {
            $cond: [{ $and: [{ $gte: ['$createdAt', range.start] }, { $lte: ['$createdAt', range.end] }] }, 1, 0],
          },
        },
      },
    },
  ]);
  return { totalCustomers: result?.totalCustomers || 0, activeCustomers: result?.activeCustomers || 0, inactiveCustomers: result?.inactiveCustomers || 0, newCustomers: result?.newCustomers || 0, dateRange: { startDate: range.startDate, endDate: range.endDate } };
};

export const getTopServices = async (user: IUser, query: any = {}) => {
  const range = resolveDateRange(query);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
  const match = await saleMatch(user, query, range);
  return SaleItem.aggregate([
    { $match: { organizationId: organizationId(user), itemType: 'SERVICE' } },
    { $lookup: { from: 'sales', localField: 'saleId', foreignField: '_id', as: 'sale' } },
    { $unwind: '$sale' },
    { $match: { 'sale.organizationId': organizationId(user), 'sale.status': 'COMPLETED', ...dateMatch('sale.createdAt', range), ...(match.branchId ? { 'sale.branchId': match.branchId } : {}) } },
    { $group: { _id: '$name', quantity: { $sum: '$quantity' }, revenue: { $sum: '$total' } } },
    { $project: { _id: 0, serviceName: '$_id', quantity: 1, revenue: { $round: ['$revenue', 2] } } },
    { $sort: { revenue: -1 } },
    { $limit: limit },
  ]);
};

const period = (days: number) => {
  const endDate = todayInBusinessTimezone();
  const startDate = addCalendarDays(endDate, -days + 1);
  return { startDate, endDate };
};

const salesForRange = async (user: IUser, query: any) => {
  const range = resolveDateRange(query);
  const match = await saleMatch(user, query, range);
  const [result] = await Sale.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]);
  return { total: round(result?.total || 0), count: result?.count || 0 };
};

export const getDashboardSummary = async (user: IUser, query: any = {}) => {
  const today = todayInBusinessTimezone();
  const week = period(7);
  const month = { startDate: `${today.slice(0, 7)}-01`, endDate: today };
  const [todaySales, weekSales, monthSales, todayReservations, upcomingReservations, customers] = await Promise.all([
    salesForRange(user, { ...query, startDate: query.startDate || today, endDate: query.endDate || today }),
    salesForRange(user, { ...query, startDate: query.startDate || week.startDate, endDate: query.endDate || week.endDate }),
    salesForRange(user, { ...query, startDate: query.startDate || month.startDate, endDate: query.endDate || month.endDate }),
    getReservationSummary(user, { ...query, startDate: today, endDate: today }),
    Reservation.countDocuments({ organizationId: organizationId(user), ...(await reservationBranchMatch(user, query)), appointmentDate: { $gt: today }, status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] } }),
    getCustomerSummary(user, { ...query, startDate: month.startDate, endDate: month.endDate }),
  ]);
  return { sales: { today: todaySales.total, thisWeek: weekSales.total, thisMonth: monthSales.total }, transactions: { today: todaySales.count, thisWeek: weekSales.count, thisMonth: monthSales.count }, reservations: { today: Object.values(todayReservations).filter(value => typeof value === 'number').reduce((sum, value) => sum + (value as number), 0), upcoming: upcomingReservations }, customers: { total: customers.totalCustomers, newThisMonth: customers.newCustomers } };
};