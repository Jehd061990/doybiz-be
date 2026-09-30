import assert from 'assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from './models/Organization';
import Branch from './models/Branch';
import User from './models/User';
import * as userService from './services/userService';
import * as platformAdminService from './services/platformAdminService';
import { getActiveSeatSummary } from './services/organizationSeatService';

dotenv.config();

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/doybiz_test');
  await Promise.all([User.deleteMany({}), Branch.deleteMany({}), Organization.deleteMany({})]);

  const org = await Organization.create({
    name: 'Seat Test Org',
    email: `seat-test-${Date.now()}@example.com`,
    phone: '09000000000',
    address: 'Test',
    status: 'ACTIVE',
    includedBranchCount: 1,
    includedUserSeats: 3,
    additionalUserSeatsPerBranch: 3,
  });

  const branchA = await Branch.create({ organizationId: org._id, name: 'Branch A', address: 'A', contactNumber: '09000000001', status: 'ACTIVE' });
  await User.create({ organizationId: org._id, name: 'Owner', email: `owner-${Date.now()}@example.com`, passwordHash: 'test', role: 'OWNER', branchAccess: 'ALL', status: 'ACTIVE' });

  for (let i = 2; i <= 3; i += 1) {
    await userService.createOrganizationUser(org._id, {
      name: `User ${i}`, email: `user${i}-${Date.now()}@example.com`, password: 'password123', role: 'CASHIER',
      branchAccess: [branchA._id.toString()], status: 'ACTIVE',
    });
  }

  let summary = await getActiveSeatSummary(org._id);
  assert.equal(summary.activeBranches, 1);
  assert.equal(summary.includedUserSeats, 3);
  assert.equal(summary.activeUsers, 3);
  assert.equal(summary.availableSeats, 0);

  await assert.rejects(() => userService.createOrganizationUser(org._id, {
    name: 'User 4', email: `user4-${Date.now()}@example.com`, password: 'password123', role: 'CASHIER',
    branchAccess: [branchA._id.toString()], status: 'ACTIVE',
  }), /included user seat limit/);

  const branchB = await Branch.create({ organizationId: org._id, name: 'Branch B', address: 'B', contactNumber: '09000000002', status: 'ACTIVE' });
  summary = await getActiveSeatSummary(org._id);
  assert.equal(summary.includedUserSeats, 6);

  for (let i = 4; i <= 6; i += 1) {
    await userService.createOrganizationUser(org._id, {
      name: `User ${i}`, email: `user${i}-${Date.now()}@example.com`, password: 'password123', role: 'CASHIER',
      branchAccess: [branchB._id.toString()], status: 'ACTIVE',
    });
  }
  summary = await getActiveSeatSummary(org._id);
  assert.equal(summary.activeUsers, 6);
  assert.equal(summary.includedUserSeats, 6);

  await assert.rejects(() => userService.createOrganizationUser(org._id, {
    name: 'User 7', email: `user7a-${Date.now()}@example.com`, password: 'password123', role: 'CASHIER',
    branchAccess: [branchB._id.toString()], status: 'ACTIVE',
  }), /included user seat limit/);

  const branchC = await Branch.create({ organizationId: org._id, name: 'Branch C', address: 'C', contactNumber: '09000000003', status: 'ACTIVE' });
  summary = await getActiveSeatSummary(org._id);
  assert.equal(summary.includedUserSeats, 9);

  await userService.createOrganizationUser(org._id, {
    name: 'User 7', email: `user7b-${Date.now()}@example.com`, password: 'password123', role: 'CASHIER',
    branchAccess: [branchC._id.toString(), branchA._id.toString()], status: 'ACTIVE',
  });

  const existingUser = await User.findOne({ organizationId: org._id, name: 'User 2' });
  if (!existingUser) throw new Error('Expected User 2');
  await userService.updateOrganizationUser(org._id, existingUser._id.toString(), { status: 'INACTIVE' });
  summary = await getActiveSeatSummary(org._id);
  assert.equal(summary.activeUsers, 6);
  await userService.updateOrganizationUser(org._id, existingUser._id.toString(), { status: 'ACTIVE' });
  summary = await getActiveSeatSummary(org._id);
  assert.equal(summary.activeUsers, 7);

  const customOrg = await platformAdminService.createOrganization({
    name: 'Custom Provisioned Org',
    email: `custom-${Date.now()}@example.com`,
    phone: '09100000000',
    address: 'Custom',
    includedBranchCount: 2,
    includedUserSeats: 6,
    additionalUserSeatsPerBranch: 4,
  });
  assert.equal(customOrg.includedBranchCount, 2);
  assert.equal(customOrg.includedUserSeats, 6);
  assert.equal(customOrg.additionalUserSeatsPerBranch, 4);

  const updated = await platformAdminService.updateOrganization(customOrg._id.toString(), {
    name: customOrg.name, email: customOrg.email, phone: customOrg.phone, address: customOrg.address,
    includedBranchCount: 3, includedUserSeats: 9, additionalUserSeatsPerBranch: 3,
  });
  assert.equal(updated.includedBranchCount, 3);
  assert.equal(updated.includedUserSeats, 9);
  assert.equal(updated.additionalUserSeatsPerBranch, 3);

  console.log('PHASE 19 SEAT PROVISIONING TESTS PASSED SUCCESSFULLY!');
  await mongoose.connection.close();
}

runTests().catch(async error => {
  console.error('Phase 19 test failed:', error);
  await mongoose.connection.close();
  process.exitCode = 1;
});
