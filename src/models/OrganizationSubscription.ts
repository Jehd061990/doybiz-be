import mongoose, { Document, Schema, Types } from 'mongoose';

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
export type SetupFeeStatus = 'PENDING' | 'PAID' | 'WAIVED';
export const PAYMENT_TERM_MONTHS = [1, 3, 6, 12] as const;
export type PaymentTermMonths = typeof PAYMENT_TERM_MONTHS[number];

export interface IOrganizationSubscription extends Document {
  organizationId: Types.ObjectId;
  planId: Types.ObjectId;
  paymentTermMonths: PaymentTermMonths;
  status: SubscriptionStatus;
  startedAt: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  setupFeeStatus: SetupFeeStatus;
  setupFeePaidAt?: Date;
  autoRenew: boolean;
  cancelledAt?: Date;
  suspendedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSubscriptionSchema: Schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true, index: true },
  planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
  paymentTermMonths: { type: Number, enum: [1, 3, 6, 12], required: true, default: 1 },
  status: { type: String, enum: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'], required: true, default: 'TRIAL', index: true },
  startedAt: { type: Date, required: true },
  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd: { type: Date, required: true },
  setupFeeStatus: { type: String, enum: ['PENDING', 'PAID', 'WAIVED'], required: true, default: 'PENDING' },
  setupFeePaidAt: { type: Date },
  autoRenew: { type: Boolean, default: true },
  cancelledAt: { type: Date },
  suspendedAt: { type: Date },
}, { timestamps: true });

export default mongoose.model<IOrganizationSubscription>('OrganizationSubscription', OrganizationSubscriptionSchema);