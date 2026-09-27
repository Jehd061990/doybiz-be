import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IStaff extends Document {
  organizationId: Types.ObjectId;
  branchId: Types.ObjectId;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  position: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const StaffSchema: Schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  position: { type: String, required: true, trim: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
}, { timestamps: true });

StaffSchema.index({ organizationId: 1, branchId: 1, status: 1 });
StaffSchema.index({ organizationId: 1, phone: 1 });

export default mongoose.model<IStaff>('Staff', StaffSchema);
