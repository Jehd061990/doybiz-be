import mongoose, { Document, Schema, Types } from 'mongoose';

export type DomainType = 'LANDING_PAGE';
export type DomainStatus = 'PENDING' | 'ACTIVE' | 'DISABLED';

export interface IDomain extends Document {
  domain: string;
  organizationId: Types.ObjectId;
  type: DomainType;
  status: DomainStatus;
  isPrimary: boolean;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DomainSchema: Schema = new Schema({
  domain: { type: String, required: true, unique: true, lowercase: true, trim: true },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  type: { type: String, enum: ['LANDING_PAGE'], default: 'LANDING_PAGE', required: true },
  status: { type: String, enum: ['PENDING', 'ACTIVE', 'DISABLED'], default: 'PENDING', index: true },
  isPrimary: { type: Boolean, default: false },
  verifiedAt: { type: Date },
}, { timestamps: true });

DomainSchema.index({ organizationId: 1, status: 1 });
DomainSchema.index({ organizationId: 1, isPrimary: 1 });

export default mongoose.model<IDomain>('Domain', DomainSchema);