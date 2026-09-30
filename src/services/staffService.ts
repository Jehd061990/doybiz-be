import Staff, { IStaff } from '../models/Staff';
import StaffService from '../models/StaffService';
import Service from '../models/Service';
import Branch from '../models/Branch';
import { Types } from 'mongoose';
import { canAccessBranch } from '../utils/branchAccess';
import { IUser } from '../models/User';

export const createStaff = async (data: any, organizationId: string, user: IUser) => {
  const { branchId, firstName, lastName, phone, email, position, status } = data;
  if (!branchId || !firstName || !lastName || !phone || !position) {
    throw new Error('Branch ID, first name, last name, phone, and position are required');
  }

  if (!Types.ObjectId.isValid(branchId)) {
    throw new Error('Invalid branch ID format');
  }

  // Verify branch belongs to organization & user has access
  const branch = await Branch.findOne({ _id: new Types.ObjectId(branchId), organizationId: new Types.ObjectId(organizationId) });
  if (!branch) {
    throw new Error('Branch not found in this organization');
  }

  if (!canAccessBranch(user, branchId)) {
    throw new Error('You do not have access to this branch');
  }

  return await Staff.create({
    organizationId: new Types.ObjectId(organizationId),
    branchId: new Types.ObjectId(branchId),
    firstName,
    lastName,
    phone,
    email,
    position,
    status: status || 'ACTIVE',
  });
};

export const getStaff = async (organizationId: string, queryParams: any = {}, user: IUser) => {
  const { branchId, search, position, status, page = 1, limit = 10 } = queryParams;
  const query: any = { organizationId: new Types.ObjectId(organizationId) };

  if (branchId) {
    if (!Types.ObjectId.isValid(branchId)) {
      throw new Error('Invalid branch ID format');
    }
    if (!canAccessBranch(user, branchId)) {
      throw new Error('You do not have access to this branch');
    }
    query.branchId = new Types.ObjectId(branchId);
  } else if (user.role !== 'OWNER' && user.branchAccess !== 'ALL') {
    // Restrict to user's allowed branches
    const allowed = Array.isArray(user.branchAccess) ? user.branchAccess.map(b => new Types.ObjectId(b)) : [];
    query.branchId = { $in: allowed };
  }

  if (status) {
    query.status = status;
  }

  if (position) {
    query.position = { $regex: position, $options: 'i' };
  }

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    query.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { phone: searchRegex },
      { position: searchRegex },
      { email: searchRegex },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await Promise.all([
    Staff.find(query).populate('branchId', 'name address').sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Staff.countDocuments(query),
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

export const getStaffById = async (id: string, organizationId: string, user: IUser) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Invalid staff ID format');
  }
  const staff = await Staff.findOne({
    _id: new Types.ObjectId(id),
    organizationId: new Types.ObjectId(organizationId),
  }).populate('branchId', 'name address');

  if (!staff) {
    throw new Error('Staff member not found');
  }

  if (!canAccessBranch(user, staff.branchId._id.toString())) {
    throw new Error('You do not have access to this branch');
  }

  return staff;
};

export const updateStaff = async (id: string, data: any, organizationId: string, user: IUser) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Invalid staff ID format');
  }

  const existing = await Staff.findOne({
    _id: new Types.ObjectId(id),
    organizationId: new Types.ObjectId(organizationId),
  });

  if (!existing) {
    throw new Error('Staff member not found');
  }

  if (!canAccessBranch(user, existing.branchId.toString())) {
    throw new Error('You do not have access to this staff member branch');
  }

  // Only allow staff-owned fields to be updated. organizationId and internal
  // document fields must never be accepted from the request body.
  const allowedFields = ['branchId', 'firstName', 'lastName', 'phone', 'email', 'position', 'status'];
  const updates: Record<string, any> = {};

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates[field] = data[field];
    }
  }

  if (updates.branchId !== undefined) {
    if (!Types.ObjectId.isValid(updates.branchId)) {
      throw new Error('Invalid branch ID format');
    }
    if (!canAccessBranch(user, updates.branchId)) {
      throw new Error('You do not have access to the target branch');
    }
    const targetBranch = await Branch.findOne({
      _id: new Types.ObjectId(updates.branchId),
      organizationId: new Types.ObjectId(organizationId),
    });
    if (!targetBranch) {
      throw new Error('Target branch not found in organization');
    }
    updates.branchId = new Types.ObjectId(updates.branchId);
  }

  return await Staff.findOneAndUpdate(
    { _id: new Types.ObjectId(id), organizationId: new Types.ObjectId(organizationId) },
    { $set: updates },
    { new: true, runValidators: true }
  ).populate('branchId', 'name address');
};
export const deleteStaff = async (id: string, organizationId: string, user: IUser) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Invalid staff ID format');
  }

  const existing = await Staff.findOne({
    _id: new Types.ObjectId(id),
    organizationId: new Types.ObjectId(organizationId),
  });

  if (!existing) {
    throw new Error('Staff member not found');
  }

  if (!canAccessBranch(user, existing.branchId.toString())) {
    throw new Error('You do not have access to this staff member branch');
  }

  const staff = await Staff.findOneAndUpdate(
    { _id: new Types.ObjectId(id), organizationId: new Types.ObjectId(organizationId) },
    { $set: { status: 'INACTIVE' } },
    { new: true }
  );

  return { message: 'Staff member deactivated successfully', staff };
};

// Staff-Service Assignment
export const assignServiceToStaff = async (staffId: string, serviceId: string, organizationId: string, user: IUser) => {
  if (!Types.ObjectId.isValid(staffId) || !Types.ObjectId.isValid(serviceId)) {
    throw new Error('Invalid staff ID or service ID format');
  }

  const orgObjId = new Types.ObjectId(organizationId);

  const staff = await Staff.findOne({ _id: new Types.ObjectId(staffId), organizationId: orgObjId });
  if (!staff) {
    throw new Error('Staff member not found');
  }

  if (!canAccessBranch(user, staff.branchId.toString())) {
    throw new Error('You do not have access to this staff member branch');
  }

  const service = await Service.findOne({ _id: new Types.ObjectId(serviceId), organizationId: orgObjId });
  if (!service) {
    throw new Error('Service not found');
  }

  // If service is branch-specific, ensure staff and service belong to the same branch
  if (service.branchId && service.branchId.toString() !== staff.branchId.toString()) {
    throw new Error('Staff and service must belong to the same branch');
  }

  const existingAssignment = await StaffService.findOne({
    organizationId: orgObjId,
    staffId: staff._id,
    serviceId: service._id,
  });

  if (existingAssignment) {
    if (existingAssignment.status === 'ACTIVE') {
      throw new Error('Service is already assigned to this staff member');
    }
    existingAssignment.status = 'ACTIVE';
    existingAssignment.branchId = staff.branchId;
    await existingAssignment.save();
    return existingAssignment;
  }

  return await StaffService.create({
    organizationId: orgObjId,
    staffId: staff._id,
    serviceId: service._id,
    branchId: staff.branchId,
    status: 'ACTIVE',
  });
};

export const unassignServiceFromStaff = async (staffId: string, serviceId: string, organizationId: string, user: IUser) => {
  if (!Types.ObjectId.isValid(staffId) || !Types.ObjectId.isValid(serviceId)) {
    throw new Error('Invalid staff ID or service ID format');
  }

  const orgObjId = new Types.ObjectId(organizationId);
  const staff = await Staff.findOne({ _id: new Types.ObjectId(staffId), organizationId: orgObjId });
  if (!staff) {
    throw new Error('Staff member not found');
  }

  if (!canAccessBranch(user, staff.branchId.toString())) {
    throw new Error('You do not have access to this staff member branch');
  }

  const assignment = await StaffService.findOne({
    organizationId: orgObjId,
    staffId: new Types.ObjectId(staffId),
    serviceId: new Types.ObjectId(serviceId),
  });

  if (!assignment) {
    throw new Error('Staff-service assignment not found');
  }

  assignment.status = 'INACTIVE';
  await assignment.save();

  return { message: 'Service unassigned from staff successfully', assignment };
};

export const getStaffServicesList = async (staffId: string, organizationId: string, user: IUser) => {
  if (!Types.ObjectId.isValid(staffId)) {
    throw new Error('Invalid staff ID format');
  }
  const orgObjId = new Types.ObjectId(organizationId);
  const staff = await Staff.findOne({ _id: new Types.ObjectId(staffId), organizationId: orgObjId });
  if (!staff) {
    throw new Error('Staff member not found');
  }

  if (!canAccessBranch(user, staff.branchId.toString())) {
    throw new Error('You do not have access to this staff member branch');
  }

  const assignments = await StaffService.find({
    organizationId: orgObjId,
    staffId: staff._id,
    status: 'ACTIVE',
  }).populate('serviceId');

  return assignments.map(a => a.serviceId);
};
