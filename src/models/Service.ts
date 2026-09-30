import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IService extends Document {
  organizationId: Types.ObjectId;
  branchId?: Types.ObjectId;
  name: string;
  code?: string;
  category?: string;
  description?: string;
  price: number;
  durationMinutes: number;
  imageSource: 'CLOUDINARY' | 'EXTERNAL_URL' | 'NONE';
  imageUrl?: string;
  imagePublicId?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema: Schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true },
  category: { type: String, trim: true },
  description: { type: String, trim: true },
  price: { type: Number, required: true, min: 0 },
  durationMinutes: { type: Number, required: true, min: 1 },
  imageSource: { type: String, enum: ['CLOUDINARY', 'EXTERNAL_URL', 'NONE'], default: 'NONE', index: true },
  imageUrl: { type: String, trim: true },
  imagePublicId: { type: String, trim: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
}, { timestamps: true });

ServiceSchema.index({ organizationId: 1, branchId: 1, status: 1 });
ServiceSchema.index({ organizationId: 1, name: 1 });
ServiceSchema.index({ organizationId: 1, code: 1 }, { sparse: true });

export default mongoose.model<IService>('Service', ServiceSchema);
