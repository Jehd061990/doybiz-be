import mongoose, { Document, Schema, Types } from 'mongoose';

export type PaymentMethod = 'CASH' | 'GCASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';
export type PaymentRecordStatus = 'COMPLETED' | 'VOIDED' | 'REFUNDED';

export interface IPayment extends Document {
  organizationId: Types.ObjectId;
  branchId: Types.ObjectId;
  saleId: Types.ObjectId;
  amount: number;
  amountReceived: number;
  change: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  receivedBy: Types.ObjectId;
  status: PaymentRecordStatus;
  notes?: string;
  paidAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema: Schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  amountReceived: { type: Number, required: true, min: 0, default: 0 },
  change: { type: Number, required: true, min: 0, default: 0 },
  paymentMethod: { type: String, enum: ['CASH', 'GCASH', 'CARD', 'BANK_TRANSFER', 'OTHER'], required: true },
  referenceNumber: { type: String, trim: true },
  receivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['COMPLETED', 'VOIDED', 'REFUNDED'], default: 'COMPLETED', index: true },
  notes: { type: String, trim: true },
  paidAt: { type: Date, required: true, default: Date.now, index: true },
}, { timestamps: true });

PaymentSchema.index({ organizationId: 1, saleId: 1, paidAt: -1 });
PaymentSchema.index({ organizationId: 1, branchId: 1, paidAt: -1 });

export default mongoose.model<IPayment>('Payment', PaymentSchema);