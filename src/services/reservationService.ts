import Reservation, { IReservation } from '../models/Reservation';
import Customer from '../models/Customer';
import Branch from '../models/Branch';
import Service from '../models/Service';
import Staff from '../models/Staff';
import StaffService from '../models/StaffService';
import { Types } from 'mongoose';
import { canAccessBranch } from '../utils/branchAccess';
import { IUser } from '../models/User';
import { parseTimeToMinutes, isTimeOverlapping, isValidDateString, normalizeTime } from '../utils/timeHelper';

export const validateAndPrepareReservation = async (data: any, organizationId: string, user?: IUser, excludeReservationId?: string) => {
  const { branchId, customerId, serviceId, staffId, appointmentDate, appointmentTime, notes, source, status } = data;

  if (!branchId || !customerId || !serviceId || !staffId || !appointmentDate || !appointmentTime) {
    throw new Error('Branch ID, customer ID, service ID, staff ID, appointment date, and appointment time are required');
  }

  const orgObjId = new Types.ObjectId(organizationId);

  // 1. Validate Customer
  if (!Types.ObjectId.isValid(customerId)) throw new Error('Invalid customer ID format');
  const customer = await Customer.findOne({ _id: new Types.ObjectId(customerId), organizationId: orgObjId, status: 'ACTIVE' });
  if (!customer) throw new Error('Customer not found or inactive');

  // 2. Validate Branch
  if (!Types.ObjectId.isValid(branchId)) throw new Error('Invalid branch ID format');
  const branch = await Branch.findOne({ _id: new Types.ObjectId(branchId), organizationId: orgObjId, status: 'ACTIVE' });
  if (!branch) throw new Error('Branch not found or inactive');

  if (user && !canAccessBranch(user, branchId)) {
    throw new Error('You do not have access to this branch');
  }

  // 3. Validate Service
  if (!Types.ObjectId.isValid(serviceId)) throw new Error('Invalid service ID format');
  const service = await Service.findOne({ _id: new Types.ObjectId(serviceId), organizationId: orgObjId, status: 'ACTIVE' });
  if (!service) throw new Error('Service not found or inactive');

  if (service.branchId && service.branchId.toString() !== branchId.toString()) {
    throw new Error('Service is not available at the selected branch');
  }

  // 4. Validate Staff
  if (!Types.ObjectId.isValid(staffId)) throw new Error('Invalid staff ID format');
  const staff = await Staff.findOne({ _id: new Types.ObjectId(staffId), organizationId: orgObjId, status: 'ACTIVE' });
  if (!staff) throw new Error('Staff member not found or inactive');

  // 5. Staff belongs to selected branch
  if (staff.branchId.toString() !== branchId.toString()) {
    throw new Error('Staff member does not belong to the selected branch');
  }

  // 6. Staff can perform selected service
  const staffServiceAssignment = await StaffService.findOne({
    organizationId: orgObjId,
    staffId: staff._id,
    serviceId: service._id,
    status: 'ACTIVE',
  });
  if (!staffServiceAssignment) {
    throw new Error('Staff member is not qualified or assigned to perform this service');
  }

  // 7. Validate Date
  if (!isValidDateString(appointmentDate)) {
    throw new Error('Invalid appointment date format (expected YYYY-MM-DD)');
  }

  // 8. Validate Time & Duration
  const normalizedTime = normalizeTime(appointmentTime);
  const newStartMins = parseTimeToMinutes(normalizedTime);
  const durationMinutes = service.durationMinutes;

  // 9. Overlap check
  const existingReservations = await Reservation.find({
    organizationId: orgObjId,
    staffId: staff._id,
    appointmentDate,
    status: { $nin: ['CANCELLED', 'NO_SHOW'] },
    ...(excludeReservationId ? { _id: { $ne: new Types.ObjectId(excludeReservationId) } } : {}),
  });

  for (const resv of existingReservations) {
    const existingStartMins = parseTimeToMinutes(resv.appointmentTime);
    if (isTimeOverlapping(newStartMins, durationMinutes, existingStartMins, resv.durationMinutes)) {
      throw new Error('Staff member is already booked for this time.');
    }
  }

  return {
    organizationId: orgObjId,
    branchId: branch._id,
    customerId: customer._id,
    serviceId: service._id,
    staffId: staff._id,
    appointmentDate,
    appointmentTime: normalizedTime,
    durationMinutes,
    notes,
    source: source || (user ? 'ADMIN' : 'WEBSITE'),
    status: status || 'PENDING',
    createdBy: user ? user._id : undefined,
  };
};

export const createReservation = async (data: any, organizationId: string, user: IUser) => {
  const prepared = await validateAndPrepareReservation(data, organizationId, user);
  const reservation = await Reservation.create(prepared);
  return await reservation.populate(['customerId', 'branchId', 'serviceId', 'staffId']);
};

export const createPublicReservation = async (data: any, organizationId: string, customerData: any) => {
  const orgObjId = new Types.ObjectId(organizationId);

  let customer = await Customer.findOne({
    organizationId: orgObjId,
    phone: customerData.phone.trim(),
  });

  if (!customer) {
    customer = await Customer.create({
      organizationId: orgObjId,
      firstName: customerData.firstName.trim(),
      lastName: customerData.lastName.trim(),
      phone: customerData.phone.trim(),
      email: customerData.email ? customerData.email.trim().toLowerCase() : undefined,
      notes: customerData.notes,
      status: 'ACTIVE',
    });
  }

  const reservationData = {
    ...data,
    customerId: customer._id.toString(),
    source: 'WEBSITE',
    status: 'PENDING',
  };

  const prepared = await validateAndPrepareReservation(reservationData, organizationId);
  const reservation = await Reservation.create(prepared);
  return await reservation.populate(['customerId', 'branchId', 'serviceId', 'staffId']);
};

export const getReservations = async (organizationId: string, queryParams: any = {}, user: IUser) => {
  const { branchId, date, status, staffId, customerId, page = 1, limit = 10 } = queryParams;
  const orgObjId = new Types.ObjectId(organizationId);
  const query: any = { organizationId: orgObjId };

  if (branchId) {
    if (!Types.ObjectId.isValid(branchId)) throw new Error('Invalid branch ID format');
    if (!canAccessBranch(user, branchId)) throw new Error('You do not have access to this branch');
    query.branchId = new Types.ObjectId(branchId);
  } else if (user.role !== 'OWNER' && user.branchAccess !== 'ALL') {
    const allowed = Array.isArray(user.branchAccess) ? user.branchAccess.map(b => new Types.ObjectId(b)) : [];
    query.branchId = { $in: allowed };
  }

  if (date) {
    if (!isValidDateString(date)) throw new Error('Invalid date filter format (YYYY-MM-DD)');
    query.appointmentDate = date;
  }

  if (status) {
    query.status = status;
  }

  if (staffId) {
    if (!Types.ObjectId.isValid(staffId)) throw new Error('Invalid staff ID format');
    query.staffId = new Types.ObjectId(staffId);
  }

  if (customerId) {
    if (!Types.ObjectId.isValid(customerId)) throw new Error('Invalid customer ID format');
    query.customerId = new Types.ObjectId(customerId);
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await Promise.all([
    Reservation.find(query)
      .populate('customerId', 'firstName lastName phone email')
      .populate('branchId', 'name address')
      .populate('serviceId', 'name price durationMinutes')
      .populate('staffId', 'firstName lastName position')
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .skip(skip)
      .limit(limitNum),
    Reservation.countDocuments(query),
  ]);

  return {
    data,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

export const getReservationById = async (id: string, organizationId: string, user: IUser) => {
  if (!Types.ObjectId.isValid(id)) throw new Error('Invalid reservation ID format');
  const reservation = await Reservation.findOne({
    _id: new Types.ObjectId(id),
    organizationId: new Types.ObjectId(organizationId),
  })
    .populate('customerId')
    .populate('branchId')
    .populate('serviceId')
    .populate('staffId');

  if (!reservation) throw new Error('Reservation not found');
  if (!canAccessBranch(user, (reservation.branchId as any)._id.toString())) {
    throw new Error('You do not have access to this reservation branch');
  }

  return reservation;
};

export const updateReservation = async (id: string, data: any, organizationId: string, user: IUser) => {
  if (!Types.ObjectId.isValid(id)) throw new Error('Invalid reservation ID format');
  const orgObjId = new Types.ObjectId(organizationId);

  const existing = await Reservation.findOne({ _id: new Types.ObjectId(id), organizationId: orgObjId });
  if (!existing) throw new Error('Reservation not found');
  if (!canAccessBranch(user, existing.branchId.toString())) {
    throw new Error('You do not have access to this reservation branch');
  }

  const mergedData = {
    branchId: data.branchId || existing.branchId.toString(),
    customerId: data.customerId || existing.customerId.toString(),
    serviceId: data.serviceId || existing.serviceId.toString(),
    staffId: data.staffId || existing.staffId.toString(),
    appointmentDate: data.appointmentDate || existing.appointmentDate,
    appointmentTime: data.appointmentTime || existing.appointmentTime,
    notes: data.notes !== undefined ? data.notes : existing.notes,
    status: data.status || existing.status,
    source: existing.source,
  };

  const prepared = await validateAndPrepareReservation(mergedData, organizationId, user, id);

  const updated = await Reservation.findOneAndUpdate(
    { _id: new Types.ObjectId(id), organizationId: orgObjId },
    { $set: prepared },
    { new: true, runValidators: true }
  ).populate(['customerId', 'branchId', 'serviceId', 'staffId']);

  return updated;
};

export const deleteReservation = async (id: string, organizationId: string, user: IUser) => {
  if (!Types.ObjectId.isValid(id)) throw new Error('Invalid reservation ID format');
  const orgObjId = new Types.ObjectId(organizationId);

  const existing = await Reservation.findOne({ _id: new Types.ObjectId(id), organizationId: orgObjId });
  if (!existing) throw new Error('Reservation not found');
  if (!canAccessBranch(user, existing.branchId.toString())) {
    throw new Error('You do not have access to this reservation branch');
  }

  existing.status = 'CANCELLED';
  await existing.save();

  return { message: 'Reservation cancelled successfully', reservation: existing };
};
