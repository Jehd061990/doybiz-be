import mongoose, { Schema, Document, Types } from 'mongoose';

export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER';

export interface IUser extends Document {
  organizationId: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  branchAccess: string[] | 'ALL'; // Array of branch IDs or 'ALL'
  billingEffectiveAt?: Date;
  billingActivationPending?: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['OWNER', 'MANAGER', 'CASHIER'], required: true },
  branchAccess: { type: Schema.Types.Mixed, required: true }, // Can be 'ALL' or [Types.ObjectId]
  billingEffectiveAt: { type: Date },
  billingActivationPending: { type: Boolean, default: false },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
}, { timestamps: true });

// Ensure unique email within an organization
UserSchema.index({ organizationId: 1, email: 1 }, { unique: true });

export default mongoose.model<IUser>('User', UserSchema);
