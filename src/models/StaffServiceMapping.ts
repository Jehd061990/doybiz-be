import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IStaffServiceMapping extends Document {
  organizationId: Types.ObjectId;
  branchId: Types.ObjectId;
  staffId: Types.ObjectId;
  serviceId: Types.ObjectId;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const StaffServiceMappingSchema: Schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  staffId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
  serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
}, { timestamps: true });

// Ensure unique mapping
StaffServiceMappingSchema.index({ staffId: 1, serviceId: 1 }, { unique: true });

export default mongoose.model<IStaffServiceMapping>('StaffServiceMapping', StaffServiceMappingSchema);
