import assert from 'assert';
import fs from 'fs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getTestMongoUri } from './testDatabase';
import { registerOrganization } from './services/authService';
import * as mediaService from './services/mediaService';
import MediaAsset from './models/MediaAsset';

dotenv.config();

async function runTests() {
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

  const asset = await mediaService.saveImage(registered.org._id, {
    originalname: 'hero.png',
    mimetype: 'image/png',
    size: 4,
    buffer: Buffer.from([137, 80, 78, 71]),
  });

  assert.equal(asset.originalName, 'hero.png');
  assert.equal(asset.mimeType, 'image/png');
  assert.match(asset.url, /^\/api\/media\//);

  const listed = await mediaService.getMediaAssets(registered.org._id);
  assert.equal(listed.length, 1);

  await mediaService.deleteMediaAsset(registered.org._id, asset._id.toString());
  assert.equal(await MediaAsset.countDocuments({ organizationId: registered.org._id }), 0);

  console.log('ALL PHASE 8 MEDIA TESTS PASSED SUCCESSFULLY!');
  await mongoose.connection.close();
}

runTests().catch(async error => {
  console.error('Phase 8 media test failed:', error);
  await mongoose.connection.close();
  process.exitCode = 1;
});
