import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMediaAsset extends Document {
  organizationId: Types.ObjectId;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}

const MediaAssetSchema = new Schema<IMediaAsset>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  originalName: { type: String, required: true, trim: true, maxlength: 255 },
  filename: { type: String, required: true, unique: true, index: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true, min: 1 },
  url: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model<IMediaAsset>('MediaAsset', MediaAssetSchema);
