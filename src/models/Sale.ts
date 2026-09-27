import mongoose, { Document, Schema, Types } from 'mongoose';

export type SaleStatus = 'DRAFT' | 'COMPLETED' | 'VOIDED' | 'REFUNDED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';

export interface ISale extends Document {
  organizationId: Types.ObjectId;
  branchId: Types.ObjectId;
  customerId?: Types.ObjectId;
  reservationId?: Types.ObjectId;
  cashierId: Types.ObjectId;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  saleNumber: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  change: number;
  paymentStatus: PaymentStatus;
  status: SaleStatus;
  notes?: string;
  voidedBy?: Types.ObjectId;
  voidedAt?: Date;
  voidReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SaleSchema: Schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
  reservationId: { type: Schema.Types.ObjectId, ref: 'Reservation', index: true },
  cashierId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  saleNumber: { type: String, required: true },
  subtotal: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, min: 0, default: 0 },
  tax: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  amountPaid: { type: Number, required: true, min: 0, default: 0 },
  change: { type: Number, required: true, min: 0, default: 0 },
  paymentStatus: { type: String, enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'], default: 'UNPAID', index: true },
  status: { type: String, enum: ['DRAFT', 'COMPLETED', 'VOIDED', 'REFUNDED'], default: 'COMPLETED', index: true },
  notes: { type: String, trim: true },
  voidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  voidedAt: { type: Date },
  voidReason: { type: String, trim: true },
}, { timestamps: true });

SaleSchema.index({ organizationId: 1, saleNumber: 1 }, { unique: true });
SaleSchema.index({ organizationId: 1, branchId: 1, createdAt: -1 });
SaleSchema.index({ organizationId: 1, customerId: 1, createdAt: -1 });
SaleSchema.index({ organizationId: 1, cashierId: 1, createdAt: -1 });

export default mongoose.model<ISale>('Sale', SaleSchema);