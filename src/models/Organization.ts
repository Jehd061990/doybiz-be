import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganization extends Document {
  name: string;
  slug?: string;
  email: string;
  phone: string;
  address: string;
  status: 'ACTIVE' | 'INACTIVE';
  /** Super Admin provisioning baseline. Defaults to 1 branch / 3 seats / +3 seats per additional branch. */
  includedBranchCount?: number;
  includedUserSeats?: number;
  additionalUserSeatsPerBranch?: number;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema: Schema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  includedBranchCount: { type: Number, min: 0, default: 1 },
  includedUserSeats: { type: Number, min: 0, default: 3 },
  additionalUserSeatsPerBranch: { type: Number, min: 0, default: 3 },
}, { timestamps: true });

export default mongoose.model<IOrganization>('Organization', OrganizationSchema);
