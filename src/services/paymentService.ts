import { Types } from 'mongoose';
import Payment, { PaymentMethod } from '../models/Payment';
import Sale from '../models/Sale';
import { IUser } from '../models/User';
import { canAccessBranch } from '../utils/branchAccess';

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const createPayment = async (saleId: string, data: any, organizationId: string, user: IUser) => {
  if (!Types.ObjectId.isValid(saleId)) throw new Error('Invalid sale ID format');
  const orgId = new Types.ObjectId(organizationId);
  const sale = await Sale.findOne({ _id: new Types.ObjectId(saleId), organizationId: orgId });
  if (!sale) throw new Error('Sale not found');
  if (!canAccessBranch(user, sale.branchId)) throw new Error('You do not have access to this sale branch');
  if (sale.status !== 'COMPLETED') throw new Error('Payments can only be recorded for completed sales');
  if (sale.paymentStatus === 'PAID') throw new Error('Sale is already fully paid');

  const amount = roundMoney(Number(data.amount));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than 0');
  const remaining = roundMoney(sale.total - sale.amountPaid);
  if (amount > remaining) throw new Error(`Payment exceeds remaining balance of ${remaining.toFixed(2)}`);

  const paymentMethod = data.paymentMethod as PaymentMethod;
  if (!['CASH', 'GCASH', 'CARD', 'BANK_TRANSFER', 'OTHER'].includes(paymentMethod)) throw new Error('Invalid payment method');
  let amountReceived = amount;
  let change = 0;
  if (paymentMethod === 'CASH') {
    amountReceived = roundMoney(Number(data.amountReceived));
    if (!Number.isFinite(amountReceived) || amountReceived < amount) throw new Error('Cash received must cover the payment amount');
    change = roundMoney(amountReceived - amount);
  }

  const newAmountPaid = roundMoney(sale.amountPaid + amount);
  const paymentStatus = newAmountPaid >= sale.total ? 'PAID' : 'PARTIALLY_PAID';
  const updatedSale = await Sale.findOneAndUpdate(
    { _id: sale._id, organizationId: orgId, status: 'COMPLETED', amountPaid: sale.amountPaid },
    { $set: { amountPaid: newAmountPaid, paymentStatus }, $inc: { change } },
    { new: true }
  );
  if (!updatedSale) throw new Error('Sale changed while recording payment; please retry');

  try {
    const payment = await Payment.create({
      organizationId: orgId,
      branchId: sale.branchId,
      saleId: sale._id,
      amount,
      amountReceived,
      change,
      paymentMethod,
      referenceNumber: data.referenceNumber,
      receivedBy: user._id,
      status: 'COMPLETED',
      notes: data.notes,
      paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
    });
    return { payment, sale: updatedSale };
  } catch (error) {
    await Sale.updateOne(
      { _id: sale._id, organizationId: orgId, amountPaid: newAmountPaid },
      { $set: { amountPaid: sale.amountPaid, paymentStatus: sale.paymentStatus }, $inc: { change: -change } }
    );
    throw error;
  }
};

export const getPayments = async (saleId: string, organizationId: string, user: IUser) => {
  if (!Types.ObjectId.isValid(saleId)) throw new Error('Invalid sale ID format');
  const sale = await Sale.findOne({ _id: new Types.ObjectId(saleId), organizationId: new Types.ObjectId(organizationId) });
  if (!sale) throw new Error('Sale not found');
  if (!canAccessBranch(user, sale.branchId)) throw new Error('You do not have access to this sale branch');
  return Payment.find({ organizationId: sale.organizationId, saleId: sale._id }).populate('receivedBy', 'name email').sort({ paidAt: 1 });
};