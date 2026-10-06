import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Types } from 'mongoose';
import MediaAsset from '../models/MediaAsset';
import WebsiteConfig from '../models/WebsiteConfig';
import { deleteMediaImage, uploadMediaImage } from './cloudinaryService';

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

  const publicId = `media-${crypto.randomUUID()}`;
  const uploaded = await uploadMediaImage(
    file.buffer,
    file.mimetype,
    organizationId.toString(),
    publicId,
  );

  try {
    return await MediaAsset.create({
      organizationId,
      originalName: path.basename(file.originalname).slice(0, 255),
      filename: uploaded.publicId,
      mimeType: file.mimetype,
      size: file.size,
      url: uploaded.secureUrl,
    });
  } catch (error) {
    await deleteMediaImage(uploaded.publicId).catch(() => undefined);
    throw error;
  }
};

export const deleteMediaAsset = async (organizationId: Types.ObjectId, id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new Error('Invalid media asset ID');
  const asset = await MediaAsset.findOne({ _id: id, organizationId });
  if (!asset) throw new Error('Media asset not found');

  const website = await WebsiteConfig.findOne({ organizationId });
  if (
    website?.draft?.hero?.backgroundImageUrl === asset.url ||
    website?.published?.hero?.backgroundImageUrl === asset.url
  ) {
    throw new Error('This image is currently used by the draft or published hero and cannot be deleted');
  }

  if (asset.url.startsWith('https://res.cloudinary.com/')) {
    await deleteMediaImage(asset.filename);
  } else {
    // Backward compatibility for assets created before Cloudinary migration.
    const absolutePath = path.join(UPLOAD_ROOT, organizationId.toString(), asset.filename);
    await fs.promises.rm(absolutePath, { force: true });
  }

  await asset.deleteOne();
};
