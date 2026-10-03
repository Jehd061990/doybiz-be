import assert from 'assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { registerOrganization } from './services/authService';
import * as websiteService from './services/websiteService';
import * as publicService from './services/publicService';
import WebsiteConfig from './models/WebsiteConfig';

dotenv.config();

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/doybiz_test');
  await WebsiteConfig.deleteMany({});
  const suffix = Date.now();
  const registered = await registerOrganization({
    orgName: 'Website CMS Salon',
    slug: `website-${suffix}`,
    email: `website-${suffix}@example.com`,
    phone: '09300000001',
    address: 'Website Address',
    userName: 'Website Owner',
    password: 'password123',
  });

  const config = await websiteService.getWebsiteConfig(registered.user);
  assert.equal(config.draft.hero.title, 'Quality service, made easy to book.');
  assert.equal(config.published.hero.title, config.draft.hero.title);

  const updated = await websiteService.updateWebsiteDraft({
    ...config.draft,
    branding: { ...config.draft.branding, primaryColor: '#123456' },
    hero: { ...config.draft.hero, title: 'Book your next salon visit.' },
  }, registered.user);
  assert.equal(updated.draft.hero.title, 'Book your next salon visit.');
  assert.equal(updated.published.hero.title, 'Quality service, made easy to book.');

  const published = await websiteService.publishWebsite(registered.user);
  assert.equal(published.published.hero.title, 'Book your next salon visit.');
  assert.equal((await publicService.getSite(registered.org)).website.hero.title, 'Book your next salon visit.');

  console.log('ALL PHASE 7 EMPIRICAL TESTS PASSED SUCCESSFULLY!');
  await WebsiteConfig.deleteMany({ organizationId: registered.org._id });
  await mongoose.connection.close();
}

runTests().catch(async error => {
  console.error('Phase 7 test failed:', error);
  await mongoose.connection.close();
  process.exitCode = 1;
});
