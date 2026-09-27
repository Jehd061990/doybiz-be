import mongoose, { Document, Schema, Types } from 'mongoose';

export type SaleItemType = 'SERVICE' | 'PRODUCT' | 'PACKAGE' | 'OTHER';

export interface ISaleItem extends Document {
  organizationId: Types.ObjectId;
  saleId: Types.ObjectId;
  branchId: Types.ObjectId;
  itemType: SaleItemType;
  referenceId?: Types.ObjectId;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  total: number;
  durationMinutes?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const SaleItemSchema: Schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  itemType: { type: String, enum: ['SERVICE', 'PRODUCT', 'PACKAGE', 'OTHER'], required: true },
  referenceId: { type: Schema.Types.ObjectId },
  name: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0.000001 },
  unitPrice: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, min: 0, default: 0 },
  subtotal: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  durationMinutes: { type: Number, min: 1 },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

SaleItemSchema.index({ organizationId: 1, saleId: 1 });

export default mongoose.model<ISaleItem>('SaleItem', SaleItemSchema);