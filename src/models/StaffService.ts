import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IStaffService extends Document {
  organizationId: Types.ObjectId;
  staffId: Types.ObjectId;
  serviceId: Types.ObjectId;
  branchId?: Types.ObjectId;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const StaffServiceSchema: Schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  staffId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
  serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
}, { timestamps: true });

StaffServiceSchema.index({ organizationId: 1, staffId: 1, serviceId: 1 }, { unique: true });
StaffServiceSchema.index({ organizationId: 1, staffId: 1 });
StaffServiceSchema.index({ organizationId: 1, serviceId: 1 });

export default mongoose.model<IStaffService>('StaffService', StaffServiceSchema);
