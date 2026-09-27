import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISaleCounter extends Document {
  organizationId: Types.ObjectId;
  branchId: Types.ObjectId;
  dateKey: string;
  sequence: number;
}

const SaleCounterSchema: Schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  dateKey: { type: String, required: true },
  sequence: { type: Number, required: true, default: 0 },
});

SaleCounterSchema.index({ organizationId: 1, branchId: 1, dateKey: 1 }, { unique: true });

export default mongoose.model<ISaleCounter>('SaleCounter', SaleCounterSchema);