import mongoose, { Document, Schema, Types } from 'mongoose';

export type BillingType = 'SETUP' | 'SUBSCRIPTION' | 'ADJUSTMENT';
export type BillingStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'VOID';

export interface IBillingLineItem {
  description: string;
  branchId?: Types.ObjectId;
  targetType?: 'BRANCH' | 'USER';
  targetId?: Types.ObjectId;
  activeUsers?: number;
  includedUsers?: number;
  additionalUsers?: number;
  userId?: Types.ObjectId;
  daysCharged?: number;
  totalBillingDays?: number;
  monthlyUnitPrice?: number;
  proratedAmount?: number;
  effectiveDate?: Date;
  endDate?: Date;
  isProrated?: boolean;
  prorationMethod?: string;
  paymentTermMonths?: number;
  branchCharge: number;
  additionalUserCharge: number;
  amount: number;
}

export interface IBillingRecord extends Document {
  organizationId: Types.ObjectId;
  subscriptionId: Types.ObjectId;
  invoiceNumber: string;
  billingType: BillingType;
  paymentTermMonths?: number;
  periodStart: Date;
  periodEnd: Date;
  subtotal: number;
  setupFee: number;
  branchCharges: number;
  additionalUserCharges: number;
  lineItems: IBillingLineItem[];
  totalAmount: number;
  currency: string;
  status: BillingStatus;
  dueDate: Date;
  paidAt?: Date;
  coverageStart?: Date;
  coverageEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BillingRecordSchema: Schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  subscriptionId: { type: Schema.Types.ObjectId, ref: 'OrganizationSubscription', required: true, index: true },
  invoiceNumber: { type: String, required: true, unique: true },
  billingType: { type: String, enum: ['SETUP', 'SUBSCRIPTION', 'ADJUSTMENT'], required: true, index: true },
  paymentTermMonths: { type: Number, enum: [1, 3, 6, 12] },
  periodStart: { type: Date, required: true, index: true },
  periodEnd: { type: Date, required: true },
  subtotal: { type: Number, required: true, min: 0 },
  setupFee: { type: Number, required: true, min: 0, default: 0 },
  branchCharges: { type: Number, required: true, min: 0, default: 0 },
  additionalUserCharges: { type: Number, required: true, min: 0, default: 0 },
  lineItems: [{
    description: { type: String, required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    targetType: { type: String, enum: ['BRANCH', 'USER'] },
    targetId: { type: Schema.Types.ObjectId },
    activeUsers: { type: Number, min: 0 },
    includedUsers: { type: Number, min: 0 },
    additionalUsers: { type: Number, min: 0 },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    daysCharged: { type: Number, min: 0 },
    totalBillingDays: { type: Number, min: 0 },
    monthlyUnitPrice: { type: Number, min: 0 },
    proratedAmount: { type: Number, min: 0 },
    effectiveDate: { type: Date },
    endDate: { type: Date },
    isProrated: { type: Boolean },
    prorationMethod: { type: String },
    paymentTermMonths: { type: Number, min: 1 },
    branchCharge: { type: Number, required: true, min: 0 },
    additionalUserCharge: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  }],
  totalAmount: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, uppercase: true },
  status: { type: String, enum: ['PENDING', 'PAID', 'OVERDUE', 'VOID'], required: true, default: 'PENDING', index: true },
  dueDate: { type: Date, required: true, index: true },
  paidAt: { type: Date },
  coverageStart: { type: Date },
  coverageEnd: { type: Date },
}, { timestamps: true });

BillingRecordSchema.index({ organizationId: 1, createdAt: -1 });
BillingRecordSchema.index({ organizationId: 1, billingType: 1, periodStart: 1, periodEnd: 1 }, { unique: true });

export default mongoose.model<IBillingRecord>('BillingRecord', BillingRecordSchema);