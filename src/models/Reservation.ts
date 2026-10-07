import mongoose, { Schema, Document, Types } from 'mongoose';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type ReservationSource = 'ADMIN' | 'STAFF' | 'WEBSITE';

export interface IReservation extends Document {
  organizationId: Types.ObjectId;
  confirmationReference?: string;
  branchId: Types.ObjectId;
  customerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  staffId: Types.ObjectId;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  durationMinutes: number;
  status: ReservationStatus;
  notes?: string;
  source: ReservationSource;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema: Schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  confirmationReference: { type: String, trim: true, uppercase: true, unique: true, sparse: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
  staffId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
  appointmentDate: { type: String, required: true, index: true },
  appointmentTime: { type: String, required: true },
  durationMinutes: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
    default: 'PENDING',
    index: true,
  },
  notes: { type: String, trim: true },
  source: {
    type: String,
    enum: ['ADMIN', 'STAFF', 'WEBSITE'],
    default: 'ADMIN',
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

ReservationSchema.index({ organizationId: 1, branchId: 1, appointmentDate: 1, staffId: 1, status: 1 });
ReservationSchema.index({ staffId: 1, appointmentDate: 1, status: 1 });
ReservationSchema.index({ organizationId: 1, customerId: 1 });
ReservationSchema.index({ organizationId: 1, appointmentDate: 1 });

export default mongoose.model<IReservation>('Reservation', ReservationSchema);
