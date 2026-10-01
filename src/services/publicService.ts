import { Types } from 'mongoose';
import Branch from '../models/Branch';
import Domain from '../models/Domain';
import Organization, { IOrganization } from '../models/Organization';
import Reservation from '../models/Reservation';
import Service from '../models/Service';
import Staff from '../models/Staff';
import StaffService from '../models/StaffService';
import { formatMinutesToTime, isTimeOverlapping, isValidDateString, parseTimeToMinutes } from '../utils/timeHelper';

const requireId = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) throw new Error(`Invalid ${field} format`);
  return new Types.ObjectId(value);
};

const publicOrganization = (organization: IOrganization) => ({
  id: organization._id,
  name: organization.name,
  email: organization.email,
  phone: organization.phone,
  address: organization.address,
});

const branchForOrganization = async (organizationId: Types.ObjectId, branchId: string) => {
  const branch = await Branch.findOne({ _id: requireId(branchId, 'branch ID'), organizationId, status: 'ACTIVE' });
  if (!branch) throw new Error('Branch not found or inactive');
  return branch;
};

const serviceForOrganization = async (organizationId: Types.ObjectId, serviceId: string) => {
  const service = await Service.findOne({ _id: requireId(serviceId, 'service ID'), organizationId, status: 'ACTIVE' });
  if (!service) throw new Error('Service not found or inactive');
  return service;
};

export const getSite = async (organization: IOrganization) => {
  const primaryDomain = await Domain.findOne({ organizationId: organization._id, status: 'ACTIVE', type: 'LANDING_PAGE', isPrimary: true }).select('domain');
  return {
    organization: publicOrganization(organization),
    primaryDomain: primaryDomain?.domain || null,
  };
};

export const getBranches = async (organization: IOrganization) => {
  const branches = await Branch.find({ organizationId: organization._id, status: 'ACTIVE' }).select('_id name address contactNumber').sort({ name: 1 });
  return branches.map(branch => ({ id: branch._id, name: branch.name, address: branch.address, contactNumber: branch.contactNumber }));
};

export const getServices = async (organization: IOrganization, branchId?: string) => {
  const query: any = { organizationId: organization._id, status: 'ACTIVE' };
  if (branchId) {
    const branch = await branchForOrganization(organization._id, branchId);
    query.$or = [{ branchId: branch._id }, { branchId: null }, { branchId: { $exists: false } }];
  } else {
    query.$or = [{ branchId: null }, { branchId: { $exists: false } }, { branchId: { $in: (await Branch.find({ organizationId: organization._id, status: 'ACTIVE' }).distinct('_id')) } }];
  }
  const services = await Service.find(query).select('_id name description price durationMinutes branchId imageUrl imageSource').sort({ name: 1 });
  return services.map(service => ({ id: service._id, name: service.name, description: service.description, price: service.price, durationMinutes: service.durationMinutes, branchId: service.branchId || null, imageUrl: service.imageUrl || null, imageSource: service.imageSource || 'NONE' }));
};

export const getStaff = async (organization: IOrganization, branchId?: string, serviceId?: string) => {
  let branchObjectId: Types.ObjectId | undefined;
  if (branchId) branchObjectId = (await branchForOrganization(organization._id, branchId))._id;
  let serviceObjectId: Types.ObjectId | undefined;
  if (serviceId) {
    const service = await serviceForOrganization(organization._id, serviceId);
    serviceObjectId = service._id;
    if (branchObjectId && service.branchId && service.branchId.toString() !== branchObjectId.toString()) throw new Error('Service is not available at the selected branch');
  }

  const query: any = { organizationId: organization._id, status: 'ACTIVE', ...(branchObjectId ? { branchId: branchObjectId } : {}) };
  let staffIds: Types.ObjectId[] | undefined;
  if (serviceObjectId) {
    staffIds = await StaffService.find({ organizationId: organization._id, serviceId: serviceObjectId, status: 'ACTIVE', ...(branchObjectId ? { branchId: branchObjectId } : {}) }).distinct('staffId');
    query._id = { $in: staffIds };
  }
  const staff = await Staff.find(query).select('_id firstName lastName position branchId').sort({ firstName: 1, lastName: 1 });
  return staff.map(member => ({ id: member._id, firstName: member.firstName, lastName: member.lastName, position: member.position, branchId: member.branchId }));
};

const staffForBooking = async (organizationId: Types.ObjectId, branchId: Types.ObjectId, serviceId: Types.ObjectId, staffId?: string) => {
  const assignmentQuery: any = { organizationId, branchId, serviceId, status: 'ACTIVE' };
  if (staffId) assignmentQuery.staffId = requireId(staffId, 'staff ID');
  const assignments = await StaffService.find(assignmentQuery).select('staffId');
  if (assignments.length === 0) throw new Error('No active staff member can perform this service at the selected branch');
  const ids = assignments.map(assignment => assignment.staffId);
  const staff = await Staff.find({ _id: { $in: ids }, organizationId, branchId, status: 'ACTIVE' }).select('_id firstName lastName');
  if (staff.length === 0) throw new Error('No active staff member can perform this service at the selected branch');
  if (staffId && staff.length !== 1) throw new Error('Staff member is not available for this service at the selected branch');
  return staff;
};

export const getAvailability = async (organization: IOrganization, query: any = {}) => {
  const branch = await branchForOrganization(organization._id, query.branchId);
  const service = await serviceForOrganization(organization._id, query.serviceId);
  if (service.branchId && service.branchId.toString() !== branch._id.toString()) throw new Error('Service is not available at the selected branch');
  const date = query.date;
  if (!isValidDateString(date)) throw new Error('Invalid date format (expected YYYY-MM-DD)');
  const staff = await staffForBooking(organization._id, branch._id, service._id, query.staffId);
  const reservations = await Reservation.find({ organizationId: organization._id, branchId: branch._id, appointmentDate: date, staffId: { $in: staff.map(member => member._id) }, status: { $nin: ['CANCELLED', 'NO_SHOW'] } }).select('staffId appointmentTime durationMinutes');
  const slots = [];
  for (let start = parseTimeToMinutes('09:00'); start + service.durationMinutes <= parseTimeToMinutes('18:00'); start += 30) {
    const availableStaff = staff.filter(member => reservations.filter(reservation => reservation.staffId.toString() === member._id.toString()).every(reservation => !isTimeOverlapping(start, service.durationMinutes, parseTimeToMinutes(reservation.appointmentTime), reservation.durationMinutes)));
    if (availableStaff.length > 0) slots.push({ time: formatMinutesToTime(start), staffIds: availableStaff.map(member => member._id) });
  }
  return { branch: { id: branch._id, name: branch.name }, service: { id: service._id, name: service.name, durationMinutes: service.durationMinutes }, date, slots };
};