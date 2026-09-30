import Service, { IService } from '../models/Service';
import Branch from '../models/Branch';
import { Types } from 'mongoose';
import { canAccessBranch } from '../utils/branchAccess';
import { IUser } from '../models/User';

export const createService = async (data: any, organizationId: string, user: IUser) => {
  const { branchId, name, description, price, durationMinutes, status } = data;
  if (!name || price === undefined || durationMinutes === undefined) {
    throw new Error('Name, price, and durationMinutes are required');
  }

  const numericPrice = Number(price);
  const numericDuration = Number(durationMinutes);

  if (isNaN(numericPrice) || numericPrice < 0) {
    throw new Error('Price must be a numeric value greater than or equal to 0');
  }

  if (isNaN(numericDuration) || numericDuration <= 0) {
    throw new Error('Duration must be greater than 0 minutes');
  }

  let branchObjId: Types.ObjectId | undefined = undefined;
  if (branchId) {
    if (!Types.ObjectId.isValid(branchId)) {
      throw new Error('Invalid branch ID format');
    }
    const branch = await Branch.findOne({ _id: new Types.ObjectId(branchId), organizationId: new Types.ObjectId(organizationId) });
    if (!branch) {
      throw new Error('Branch not found in this organization');
    }
    if (!canAccessBranch(user, branchId)) {
      throw new Error('You do not have access to this branch');
    }
    branchObjId = new Types.ObjectId(branchId);
  }

  return await Service.create({
    organizationId: new Types.ObjectId(organizationId),
    branchId: branchObjId,
    name,
    description,
    price: numericPrice,
    durationMinutes: numericDuration,
    status: status || 'ACTIVE',
  });
};

export const getServices = async (organizationId: string, queryParams: any = {}, user: IUser) => {
  const { branchId, search, status, page = 1, limit = 10 } = queryParams;
  const query: any = { organizationId: new Types.ObjectId(organizationId) };
  const andConditions: any[] = [];

  // Keep branch scope separate from text search so search can never widen
  // the result set beyond the user's permitted branches.
  if (branchId) {
    if (!Types.ObjectId.isValid(branchId)) {
      throw new Error('Invalid branch ID format');
    }
    if (!canAccessBranch(user, branchId)) {
      throw new Error('You do not have access to this branch');
    }
    andConditions.push({
      $or: [
        { branchId: new Types.ObjectId(branchId) },
        { branchId: { $exists: false } },
        { branchId: null },
      ],
    });
  } else if (user.role !== 'OWNER' && user.branchAccess !== 'ALL') {
    const allowed = Array.isArray(user.branchAccess)
      ? user.branchAccess.map(b => new Types.ObjectId(b))
      : [];
    andConditions.push({
      $or: [
        { branchId: { $in: allowed } },
        { branchId: { $exists: false } },
        { branchId: null },
      ],
    });
  }

  if (status) {
    query.status = status;
  }

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    andConditions.push({
      $or: [
        { name: searchRegex },
        { description: searchRegex },
      ],
    });
  }

  if (andConditions.length) {
    query.$and = andConditions;
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await Promise.all([
    Service.find(query).populate('branchId', 'name address').sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Service.countDocuments(query),
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
export const getServiceById = async (id: string, organizationId: string, user: IUser) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Invalid service ID format');
  }
  const service = await Service.findOne({
    _id: new Types.ObjectId(id),
    organizationId: new Types.ObjectId(organizationId),
  }).populate('branchId', 'name address');

  if (!service) {
    throw new Error('Service not found');
  }

  if (service.branchId && !canAccessBranch(user, service.branchId._id.toString())) {
    throw new Error('You do not have access to this service branch');
  }

  return service;
};

export const updateService = async (id: string, data: any, organizationId: string, user: IUser) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Invalid service ID format');
  }

  const existing = await Service.findOne({
    _id: new Types.ObjectId(id),
    organizationId: new Types.ObjectId(organizationId),
  });

  if (!existing) {
    throw new Error('Service not found');
  }

  if (existing.branchId && !canAccessBranch(user, existing.branchId.toString())) {
    throw new Error('You do not have access to this service branch');
  }

  if (data.price !== undefined) {
    const p = Number(data.price);
    if (isNaN(p) || p < 0) throw new Error('Price must be >= 0');
    data.price = p;
  }

  if (data.durationMinutes !== undefined) {
    const d = Number(data.durationMinutes);
    if (isNaN(d) || d <= 0) throw new Error('Duration must be > 0');
    data.durationMinutes = d;
  }

  if (data.branchId) {
    if (!Types.ObjectId.isValid(data.branchId)) {
      throw new Error('Invalid branch ID format');
    }
    if (!canAccessBranch(user, data.branchId)) {
      throw new Error('You do not have access to target branch');
    }
    data.branchId = new Types.ObjectId(data.branchId);
  }

  const service = await Service.findOneAndUpdate(
    { _id: new Types.ObjectId(id), organizationId: new Types.ObjectId(organizationId) },
    { $set: data },
    { new: true, runValidators: true }
  ).populate('branchId', 'name address');

  return service;
};

export const deleteService = async (id: string, organizationId: string, user: IUser) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Invalid service ID format');
  }

  const existing = await Service.findOne({
    _id: new Types.ObjectId(id),
    organizationId: new Types.ObjectId(organizationId),
  });

  if (!existing) {
    throw new Error('Service not found');
  }

  if (existing.branchId && !canAccessBranch(user, existing.branchId.toString())) {
    throw new Error('You do not have access to this service branch');
  }

  const service = await Service.findOneAndUpdate(
    { _id: new Types.ObjectId(id), organizationId: new Types.ObjectId(organizationId) },
    { $set: { status: 'INACTIVE' } },
    { new: true }
  );

  return { message: 'Service deactivated successfully', service };
};
