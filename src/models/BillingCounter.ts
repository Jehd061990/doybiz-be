import mongoose, { Document, Schema } from 'mongoose';

export interface IBillingCounter extends Document {
  year: number;
  sequence: number;
}

const BillingCounterSchema: Schema = new Schema({
  year: { type: Number, required: true },
  sequence: { type: Number, required: true, default: 0 },
});

BillingCounterSchema.index({ year: 1 }, { unique: true });

export default mongoose.model<IBillingCounter>('BillingCounter', BillingCounterSchema);