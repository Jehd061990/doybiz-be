import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IService extends Document {
  organizationId: Types.ObjectId;
  branchId?: Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  durationMinutes: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema: Schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  price: { type: Number, required: true, min: 0 },
  durationMinutes: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
}, { timestamps: true });

ServiceSchema.index({ organizationId: 1, branchId: 1, status: 1 });
ServiceSchema.index({ organizationId: 1, name: 1 });

export default mongoose.model<IService>('Service', ServiceSchema);
