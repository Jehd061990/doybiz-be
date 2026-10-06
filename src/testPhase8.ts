import assert from 'assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getTestMongoUri } from './testDatabase';
import { registerOrganization } from './services/authService';
import * as mediaService from './services/mediaService';
import MediaAsset from './models/MediaAsset';

dotenv.config();

async function runTests() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Phase 8 media integration test requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
  }

  await mongoose.connect(getTestMongoUri());
  const suffix = Date.now();
  const registered = await registerOrganization({
    orgName: 'Media Library Salon',
    slug: `media-${suffix}`,
    email: `media-${suffix}@example.com`,
    phone: '09300000002',
    address: 'Media Address',
    userName: 'Media Owner',
    password: 'password123',
  });

  // 1x1 transparent PNG.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );

  const asset = await mediaService.saveImage(registered.org._id, {
    originalname: 'hero.png',
    mimetype: 'image/png',
    size: png.length,
    buffer: png,
  });

  assert.equal(asset.originalName, 'hero.png');
  assert.equal(asset.mimeType, 'image/png');
  assert.match(asset.url, /^https:\/\/res\.cloudinary\.com\//);
  assert.match(asset.filename, /^doybiz\/organizations\/.+\/media\/media-/);

  const listed = await mediaService.getMediaAssets(registered.org._id);
  assert.equal(listed.length, 1);

  await mediaService.deleteMediaAsset(registered.org._id, asset._id.toString());
  assert.equal(await MediaAsset.countDocuments({ organizationId: registered.org._id }), 0);

  console.log('ALL PHASE 8 CLOUDINARY MEDIA TESTS PASSED SUCCESSFULLY!');
  await mongoose.connection.close();
}

runTests().catch(async error => {
  console.error('Phase 8 media test failed:', error);
  await mongoose.connection.close();
  process.exitCode = 1;
});
