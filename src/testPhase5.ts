import assert from 'assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { registerOrganization } from './services/authService';
import * as publicService from './services/publicService';
import * as reservationService from './services/reservationService';
import { resolveTenant } from './middlewares/tenantResolver';
import Organization from './models/Organization';
import Domain from './models/Domain';
import User from './models/User';
import Branch from './models/Branch';
import Customer from './models/Customer';
import Service from './models/Service';
import Staff from './models/Staff';
import StaffService from './models/StaffService';
import { getTestMongoUri } from './testDatabase';
import Reservation from './models/Reservation';
import Sale from './models/Sale';
import Payment from './models/Payment';
import SaleItem from './models/SaleItem';
import SaleCounter from './models/SaleCounter';

dotenv.config();

async function runTests() {
  const mongoUri = getTestMongoUri();
  console.log('Connecting to isolated test database.');
  await mongoose.connect(mongoUri);
  await Promise.all([
    Payment.deleteMany({}), SaleItem.deleteMany({}), Sale.deleteMany({}), SaleCounter.deleteMany({}), Reservation.deleteMany({}),
    StaffService.deleteMany({}), Staff.deleteMany({}), Service.deleteMany({}), Customer.deleteMany({}), Domain.deleteMany({}),
    Branch.deleteMany({}), User.deleteMany({}), Organization.deleteMany({}),
  ]);

  const suffix = Date.now();
  const first = await registerOrganization({ orgName: 'Public Salon', slug: `public-${suffix}`, email: `public-${suffix}@example.com`, phone: '09300000001', address: 'Public Address', userName: 'Public Owner', password: 'password123' });
  const second = await registerOrganization({ orgName: 'Other Salon', slug: `other-${suffix}`, email: `other-${suffix}@example.com`, phone: '09300000002', address: 'Other Address', userName: 'Other Owner', password: 'password123' });
  const branch = await Branch.create({ organizationId: first.org._id, name: 'Main Branch', address: 'Main', contactNumber: '09300000003', status: 'ACTIVE' });
  const otherBranch = await Branch.create({ organizationId: second.org._id, name: 'Other Branch', address: 'Other', contactNumber: '09300000004', status: 'ACTIVE' });
  const service = await Service.create({ organizationId: first.org._id, branchId: branch._id, name: 'Haircut', description: 'Public haircut', price: 300, durationMinutes: 60, status: 'ACTIVE' });
  const otherService = await Service.create({ organizationId: second.org._id, branchId: otherBranch._id, name: 'Other Service', price: 500, durationMinutes: 60, status: 'ACTIVE' });
  const staff = await Staff.create({ organizationId: first.org._id, branchId: branch._id, firstName: 'Maria', lastName: 'Santos', phone: '09300000005', position: 'Stylist', status: 'ACTIVE' });
  await StaffService.create({ organizationId: first.org._id, staffId: staff._id, serviceId: service._id, branchId: branch._id, status: 'ACTIVE' });
  await Domain.create({ domain: `www.public-${suffix}.com`, organizationId: first.org._id, type: 'LANDING_PAGE', status: 'ACTIVE', isPrimary: true });

  let resolvedOrganization: any;
  const request: any = { headers: { host: `www.public-${suffix}.com` }, query: {}, header(name: string) { return this.headers[name.toLowerCase()]; } };
  await new Promise<void>((resolve, reject) => resolveTenant(request, {} as any, () => { resolvedOrganization = request.organization; resolve(); }));
  assert.equal(resolvedOrganization._id.toString(), first.org._id.toString());

  const originalNodeEnv = process.env.NODE_ENV;
  const originalPublicHosts = process.env.DOYBIZ_PUBLIC_HOSTS;
  const originalPublicHostPatterns = process.env.DOYBIZ_PUBLIC_HOST_PATTERNS;
  process.env.NODE_ENV = 'production';
  process.env.DOYBIZ_PUBLIC_HOSTS = 'doybiz-fe-kz2h.vercel.app';
  process.env.DOYBIZ_PUBLIC_HOST_PATTERNS = 'doybiz-fe-*.vercel.app';

  let platformResolvedOrganization: any;
  const platformRequest: any = {
    headers: { host: 'doybiz-fe-kz2h.vercel.app' },
    query: { tenant: first.org.slug },
    header(name: string) { return this.headers[name.toLowerCase()]; },
  };
  await new Promise<void>((resolve) => resolveTenant(platformRequest, {} as any, () => {
    platformResolvedOrganization = platformRequest.organization;
    resolve();
  }));
  assert.equal(platformResolvedOrganization._id.toString(), first.org._id.toString());

  let patternResolvedOrganization: any;
  const patternRequest: any = {
    headers: { host: 'doybiz-fe-preview-abc.vercel.app' },
    query: { tenant: first.org.slug },
    header(name: string) { return this.headers[name.toLowerCase()]; },
  };
  await new Promise<void>((resolve) => resolveTenant(patternRequest, {} as any, () => {
    patternResolvedOrganization = patternRequest.organization;
    resolve();
  }));
  assert.equal(patternResolvedOrganization._id.toString(), first.org._id.toString());

  let rejectedPatternStatus: number | undefined;
  const unrelatedVercelRequest: any = {
    headers: { host: 'other-project-preview.vercel.app' },
    query: { tenant: first.org.slug },
    header(name: string) { return this.headers[name.toLowerCase()]; },
  };
  await new Promise<void>((resolve) => resolveTenant(unrelatedVercelRequest, {
    status(code: number) {
      rejectedPatternStatus = code;
      return { json() { resolve(); } };
    },
  } as any, () => resolve()));
  assert.equal(rejectedPatternStatus, 400);

  let rejectedStatus: number | undefined;
  let rejectedBody: any;
  const unapprovedRequest: any = {
    headers: { host: 'untrusted-preview.example.com' },
    query: { tenant: first.org.slug },
    header(name: string) { return this.headers[name.toLowerCase()]; },
  };
  await new Promise<void>((resolve) => resolveTenant(unapprovedRequest, {
    status(code: number) {
      rejectedStatus = code;
      return {
        json(body: any) {
          rejectedBody = body;
          resolve();
        },
      };
    },
  } as any, () => resolve()));
  assert.equal(rejectedStatus, 400);
  assert.equal(rejectedBody.message, 'Invalid or missing public tenant domain.');

  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalPublicHosts === undefined) delete process.env.DOYBIZ_PUBLIC_HOSTS;
  else process.env.DOYBIZ_PUBLIC_HOSTS = originalPublicHosts;
  if (originalPublicHostPatterns === undefined) delete process.env.DOYBIZ_PUBLIC_HOST_PATTERNS;
  else process.env.DOYBIZ_PUBLIC_HOST_PATTERNS = originalPublicHostPatterns;

  const site = await publicService.getSite(first.org);
  assert.equal(site.organization.name, 'Public Salon');
  assert.equal((site as any).website.template, 'CLASSIC');
  assert.deepEqual((site as any).website.templateSettings, {
    classic: {
      heroAlignment: 'left',
      navigationStyle: 'standard',
      sectionSpacing: 'comfortable',
      heroImagePosition: 'center',
      ctaStyle: 'solid',
    },
    modernLuxury: {
      heroComposition: 'full-bleed',
      navigationStyle: 'editorial',
      sectionSpacing: 'airy',
      imageTreatment: 'natural',
      overlayIntensity: 'strong',
      showHeroBadge: true,
    },
    minimalModern: {
      heroAlignment: 'left',
      navigationStyle: 'minimal',
      sectionSpacing: 'airy',
      heroImagePosition: 'right',
      ctaStyle: 'solid',
    },
  });
  assert.equal((site as any).organization.passwordHash, undefined);
  assert.equal((await publicService.getBranches(first.org)).length, 1);
  assert.equal((await publicService.getServices(first.org, branch._id.toString())).length, 1);
  assert.equal((await publicService.getStaff(first.org, branch._id.toString(), service._id.toString())).length, 1);
  await assert.rejects(() => publicService.getServices(first.org, otherBranch._id.toString()), /not found or inactive/);
  await assert.rejects(() => publicService.getServices(first.org, otherService._id.toString()), /not found/);

  const date = '2026-10-15';
  const availability = await publicService.getAvailability(first.org, { branchId: branch._id.toString(), serviceId: service._id.toString(), staffId: staff._id.toString(), date });
  assert.ok(availability.slots.some(slot => slot.time === '10:00'));
  const reservation = await reservationService.createPublicReservation({ branchId: branch._id.toString(), serviceId: service._id.toString(), staffId: staff._id.toString(), appointmentDate: date, appointmentTime: '10:00', status: 'COMPLETED' }, first.org._id.toString(), { firstName: 'Jane', lastName: 'Doe', phone: `094${suffix}`, email: 'jane@example.com' });
  assert.equal(reservation.status, 'PENDING');
  assert.equal((await publicService.getAvailability(first.org, { branchId: branch._id.toString(), serviceId: service._id.toString(), staffId: staff._id.toString(), date })).slots.some(slot => slot.time === '10:00'), false);
  await assert.rejects(() => publicService.getAvailability(first.org, { branchId: branch._id.toString(), serviceId: otherService._id.toString(), date }), /not found/);
  await assert.rejects(() => reservationService.createPublicReservation({ branchId: branch._id.toString(), serviceId: service._id.toString(), staffId: staff._id.toString(), appointmentDate: date, appointmentTime: '10:30' }, first.org._id.toString(), { firstName: 'Jane', lastName: 'Again', phone: `095${suffix}` }), /already booked/);

  console.log('ALL PHASE 5 EMPIRICAL TESTS PASSED SUCCESSFULLY!');
  await mongoose.connection.close();
}

runTests().catch(async error => {
  console.error('Phase 5 test failed:', error);
  await mongoose.connection.close();
  process.exitCode = 1;
});