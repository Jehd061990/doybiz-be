import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Types } from 'mongoose';
import MediaAsset from '../models/MediaAsset';

const UPLOAD_ROOT = path.resolve(process.env.MEDIA_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'media'));
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const getMediaAssets = async (organizationId: Types.ObjectId) =>
  MediaAsset.find({ organizationId }).sort({ createdAt: -1 });

export const saveImage = async (
  organizationId: Types.ObjectId,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
) => {
  if (!ALLOWED_TYPES[file.mimetype]) throw new Error('Only JPG, PNG, and WebP images are supported');
  if (file.size > MAX_FILE_SIZE) throw new Error('Image must be 5 MB or smaller');

  const organizationDir = path.join(UPLOAD_ROOT, organizationId.toString());
  await fs.promises.mkdir(organizationDir, { recursive: true });

  const filename = `${crypto.randomUUID()}${ALLOWED_TYPES[file.mimetype]}`;
  const absolutePath = path.join(organizationDir, filename);
  await fs.promises.writeFile(absolutePath, file.buffer);

  const url = `/api/media/${organizationId.toString()}/${filename}`;
  try {
    return await MediaAsset.create({
      organizationId,
      originalName: path.basename(file.originalname).slice(0, 255),
      filename,
      mimeType: file.mimetype,
      size: file.size,
      url,
    });
  } catch (error) {
    await fs.promises.rm(absolutePath, { force: true });
    throw error;
  }
};

export const deleteMediaAsset = async (organizationId: Types.ObjectId, id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new Error('Invalid media asset ID');
  const asset = await MediaAsset.findOne({ _id: id, organizationId });
  if (!asset) throw new Error('Media asset not found');

  const absolutePath = path.join(UPLOAD_ROOT, organizationId.toString(), asset.filename);
  await fs.promises.rm(absolutePath, { force: true });
  await asset.deleteOne();
};
