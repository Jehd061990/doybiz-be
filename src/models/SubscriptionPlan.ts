import mongoose, { Document, Schema } from 'mongoose';

export type BillingInterval = 'MONTHLY';
export type PlanStatus = 'ACTIVE' | 'INACTIVE';

export interface ISubscriptionPlan extends Document {
  name: string;
  code: string;
  setupFee: number;
  monthlyBranchPrice: number;
  includedUsersPerBranch: number;
  additionalUserPrice: number;
  currency: string;
  billingInterval: BillingInterval;
  status: PlanStatus;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema: Schema = new Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  setupFee: { type: Number, required: true, min: 0 },
  monthlyBranchPrice: { type: Number, required: true, min: 0 },
  includedUsersPerBranch: { type: Number, required: true, min: 0 },
  additionalUserPrice: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, uppercase: true, default: 'PHP' },
  billingInterval: { type: String, enum: ['MONTHLY'], required: true, default: 'MONTHLY' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], required: true, default: 'ACTIVE', index: true },
}, { timestamps: true });

export default mongoose.model<ISubscriptionPlan>('SubscriptionPlan', SubscriptionPlanSchema);