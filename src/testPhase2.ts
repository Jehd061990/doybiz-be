import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getTestMongoUri } from './testDatabase';
import Organization from './models/Organization';
import User from './models/User';
import Branch from './models/Branch';
import Customer from './models/Customer';
import Staff from './models/Staff';
import Service from './models/Service';
import StaffService from './models/StaffService';
import Reservation from './models/Reservation';
import { registerOrganization, login } from './services/authService';
import * as customerService from './services/customerService';
import * as staffService from './services/staffService';
import * as serviceService from './services/serviceService';
import * as reservationService from './services/reservationService';

dotenv.config();

async function runTests() {
  console.log('Starting Phase 2 Empirical Tests...');
  const MONGODB_URI = getTestMongoUri();
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB for testing');

  // Clean up test data
  await Organization.deleteMany({});
  await User.deleteMany({});
  await Branch.deleteMany({});
  await Customer.deleteMany({});
  await Staff.deleteMany({});
  await Service.deleteMany({});
  await StaffService.deleteMany({});
  await Reservation.deleteMany({});

  // 1. Register Organization 1
  const org1Result = await registerOrganization({
    orgName: 'Salon Delight',
    slug: 'salondelight',
    email: 'owner@salondelight.com',
    phone: '09123456789',
    address: '123 Main St',
    userName: 'Alice Owner',
    password: 'password123',
  });
  const org1Id = org1Result.org._id.toString();
  const owner1 = org1Result.user;
  console.log('Test 1 Passed: Organization 1 registered with slug "salondelight"');

  // 2. Create Branch 1 (Downtown)
  const branch1 = await Branch.create({
    organizationId: org1Result.org._id,
    name: 'Downtown Branch',
    address: '1st Avenue',
    contactNumber: '09111111111',
  });
  console.log('Test 2 Passed: Branch created:', branch1.name);

  // 3. Customer Management
  const customer = await customerService.createCustomer({
    firstName: 'John',
    lastName: 'Doe',
    phone: '09998887777',
    email: 'john@example.com',
  }, org1Id);
  console.log('Test 3 Passed: Customer created:', customer.firstName);

  // 4. Staff Management
  const staff = await staffService.createStaff({
    branchId: branch1._id.toString(),
    firstName: 'Maria',
    lastName: 'Santos',
    phone: '09223334444',
    position: 'Hair Stylist',
  }, org1Id, owner1);
  console.log('Test 4 Passed: Staff created:', staff.firstName, staff.position);

  // 5. Service Management
  const service = await serviceService.createService({
    branchId: branch1._id.toString(),
    name: 'Hair Color',
    price: 1500,
    durationMinutes: 120,
  }, org1Id, owner1);
  console.log('Test 5 Passed: Service created:', service.name, 'Price:', service.price, 'Duration:', service.durationMinutes);

  // 6. Staff-Service Relationship
  const assignment = await staffService.assignServiceToStaff(
    staff._id.toString(),
    service._id.toString(),
    org1Id,
    owner1
  );
  console.log('Test 6 Passed: Staff assigned to service successfully');

  // 7. Reservation Creation
  const reservation = await reservationService.createReservation({
    branchId: branch1._id.toString(),
    customerId: customer._id.toString(),
    serviceId: service._id.toString(),
    staffId: staff._id.toString(),
    appointmentDate: '2026-10-05',
    appointmentTime: '14:00',
    notes: 'First time client',
  }, org1Id, owner1);
  console.log('Test 7 Passed: Reservation created for 14:00 - 16:00');

  // 8. Double-booking prevention test
  try {
    await reservationService.createReservation({
      branchId: branch1._id.toString(),
      customerId: customer._id.toString(),
      serviceId: service._id.toString(),
      staffId: staff._id.toString(),
      appointmentDate: '2026-10-05',
      appointmentTime: '15:00', // Overlaps with 14:00 - 16:00
    }, org1Id, owner1);
    throw new Error('Should have failed due to double booking');
  } catch (err: any) {
    if (err.message.includes('already booked')) {
      console.log('Test 8 Passed: Double booking successfully prevented:', err.message);
    } else {
      throw err;
    }
  }

  // 9. Non-overlapping back-to-back booking test (starts at 16:00)
  const backToBackReservation = await reservationService.createReservation({
    branchId: branch1._id.toString(),
    customerId: customer._id.toString(),
    serviceId: service._id.toString(),
    staffId: staff._id.toString(),
    appointmentDate: '2026-10-05',
    appointmentTime: '16:00', // Back to back
  }, org1Id, owner1);
  console.log('Test 9 Passed: Back-to-back reservation at 16:00 accepted');

  // 10. Public Reservation API test (via createPublicReservation)
  const publicResv = await reservationService.createPublicReservation({
    branchId: branch1._id.toString(),
    serviceId: service._id.toString(),
    staffId: staff._id.toString(),
    appointmentDate: '2026-10-06',
    appointmentTime: '10:00',
  }, org1Id, {
    firstName: 'Jane',
    lastName: 'Smith',
    phone: '09887766554',
    email: 'jane@example.com',
  });
  if (!publicResv.confirmationReference) throw new Error('Public reservation confirmation reference was not generated');
  if (!/^[A-Z2-9]{6}$/.test(publicResv.confirmationReference)) throw new Error(`Invalid public confirmation reference format: ${publicResv.confirmationReference}`);
  if (publicResv.confirmationReference === publicResv._id.toString()) throw new Error('Public confirmation reference must not expose the MongoDB reservation ID');
  console.log('Test 10 Passed: Public website reservation created with 6-character confirmation reference:', publicResv.confirmationReference);

  console.log('ALL PHASE 2 EMPIRICAL TESTS PASSED SUCCESSFULLY!');
  await mongoose.connection.close();
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  mongoose.connection.close();
  process.exit(1);
});
