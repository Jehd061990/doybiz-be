import mongoose, { Document, Schema, Types } from 'mongoose';

export type BillingPaymentMethod = 'CASH' | 'GCASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
export type BillingPaymentStatus = 'PENDING' | 'COMPLETED' | 'VOIDED' | 'REFUNDED';

export interface IBillingPayment extends Document {
  organizationId: Types.ObjectId;
  billingRecordId: Types.ObjectId;
  amount: number;
  paymentMethod: BillingPaymentMethod;
  referenceNumber?: string;
  idempotencyKey: string;
  status: BillingPaymentStatus;
  providerName?: 'XENDIT';
  providerPaymentRequestId?: string;
  providerReferenceId?: string;
  providerStatus?: string;
  providerData?: Record<string, any>;
  paidAt: Date;
  receivedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BillingPaymentSchema: Schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  billingRecordId: { type: Schema.Types.ObjectId, ref: 'BillingRecord', required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  paymentMethod: { type: String, enum: ['CASH', 'GCASH', 'BANK_TRANSFER', 'CARD', 'OTHER'], required: true },
  referenceNumber: { type: String, trim: true },
  idempotencyKey: { type: String, required: true, trim: true },
  status: { type: String, enum: ['PENDING', 'COMPLETED', 'VOIDED', 'REFUNDED'], required: true, default: 'PENDING', index: true },
  providerName: { type: String, enum: ['XENDIT'], index: true },
  providerPaymentRequestId: { type: String, trim: true, index: true },
  providerReferenceId: { type: String, trim: true },
  providerStatus: { type: String, trim: true },
  providerData: { type: Schema.Types.Mixed },
  paidAt: { type: Date, required: true, default: Date.now, index: true },
  receivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

BillingPaymentSchema.index({ organizationId: 1, billingRecordId: 1, paidAt: -1 });
BillingPaymentSchema.index({ organizationId: 1, billingRecordId: 1, idempotencyKey: 1 }, { unique: true });

export default mongoose.model<IBillingPayment>('BillingPayment', BillingPaymentSchema);