import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBranch extends Document {
  organizationId: Types.ObjectId;
  name: string;
  address: string;
  contactNumber: string;
  billingEffectiveAt?: Date;
  billingActivationPending?: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema: Schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  contactNumber: { type: String, required: true },
  billingEffectiveAt: { type: Date },
  billingActivationPending: { type: Boolean, default: false },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
}, { timestamps: true });

export default mongoose.model<IBranch>('Branch', BranchSchema);
