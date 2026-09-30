import { Types } from 'mongoose';
import Service from '../models/Service';
import Branch from '../models/Branch';
import { canAccessBranch } from '../utils/branchAccess';
import { IUser } from '../models/User';
import { deleteServiceImage, uploadServiceImage } from './cloudinaryService';

const ALLOWED_UPDATE_FIELDS = new Set(['branchId', 'name', 'code', 'category', 'description', 'price', 'durationMinutes', 'status']);
const sanitizeUpdate = (data: Record<string, unknown>) => Object.fromEntries(Object.entries(data).filter(([key]) => ALLOWED_UPDATE_FIELDS.has(key)));
const validateStatus = (value: unknown): 'ACTIVE' | 'INACTIVE' => { if (value === undefined) return 'ACTIVE'; if (value !== 'ACTIVE' && value !== 'INACTIVE') throw new Error('Status must be ACTIVE or INACTIVE'); return value; };

const validateBranch = async (branchId: unknown, organizationId: string, user: IUser) => {
  if (!branchId) return undefined;
  if (typeof branchId !== 'string' || !Types.ObjectId.isValid(branchId)) throw new Error('Invalid branch ID format');
  const branch = await Branch.findOne({ _id: new Types.ObjectId(branchId), organizationId: new Types.ObjectId(organizationId) });
  if (!branch) throw new Error('Branch not found in this organization');
  if (!canAccessBranch(user, branchId)) throw new Error('You do not have access to this branch');
  return new Types.ObjectId(branchId);
};

const validateCore = (data: any) => {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) throw new Error('Service name is required');
  const price = Number(data.price), durationMinutes = Number(data.durationMinutes);
  if (!Number.isFinite(price) || price < 0) throw new Error('Price must be a numeric value greater than or equal to 0');
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) throw new Error('Duration must be greater than 0 minutes');
  return { name, price, durationMinutes };
};

export const createService = async (data: any, organizationId: string, user: IUser) => {
  const core = validateCore(data);
  const branchId = await validateBranch(data.branchId, organizationId, user);
  const service = await Service.create({ organizationId: new Types.ObjectId(organizationId), branchId, name: core.name, code: typeof data.code === 'string' ? data.code.trim() || undefined : undefined, category: typeof data.category === 'string' ? data.category.trim() || undefined : undefined, description: typeof data.description === 'string' ? data.description.trim() || undefined : undefined, price: core.price, durationMinutes: core.durationMinutes, status: validateStatus(data.status) });
  try {
    if (data.imageData) { const uploaded = await uploadServiceImage(data.imageData, organizationId, service._id.toString()); service.imageUrl = uploaded.secureUrl; service.imagePublicId = uploaded.publicId; await service.save(); }
  } catch (error) { await Service.deleteOne({ _id: service._id, organizationId: service.organizationId }); throw error; }
  return service;
};

export const getServices = async (organizationId: string, queryParams: any = {}, user: IUser) => {
  const { branchId, search, category, status, page = 1, limit = 24 } = queryParams;
  const query: any = { organizationId: new Types.ObjectId(organizationId) };
  const andConditions: any[] = [];
  if (branchId) {
    if (!Types.ObjectId.isValid(branchId)) throw new Error('Invalid branch ID format');
    if (!canAccessBranch(user, branchId)) throw new Error('You do not have access to this branch');
    andConditions.push({ $or: [{ branchId: new Types.ObjectId(branchId) }, { branchId: { $exists: false } }, { branchId: null }] });
  } else if (user.role !== 'OWNER' && user.branchAccess !== 'ALL') {
    const allowed = Array.isArray(user.branchAccess) ? user.branchAccess.map(b => new Types.ObjectId(b)) : [];
    andConditions.push({ $or: [{ branchId: { $in: allowed } }, { branchId: { $exists: false } }, { branchId: null }] });
  }
  if (status) query.status = status;
  if (category) query.category = category;
  if (search) {
    const escaped = String(search).replace(/[.*+?^$()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    andConditions.push({ $or: [{ name: regex }, { code: regex }, { category: regex }, { description: regex }] });
  }
  if (andConditions.length) query.$and = andConditions;
  const pageNum = Math.max(1, parseInt(String(page), 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)));
  const [data, total] = await Promise.all([Service.find(query).populate('branchId', 'name address').sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum), Service.countDocuments(query)]);
  return { data, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 } };
};

export const getServiceById = async (id: string, organizationId: string, user: IUser) => {
  if (!Types.ObjectId.isValid(id)) throw new Error('Invalid service ID format');
  const service = await Service.findOne({ _id: new Types.ObjectId(id), organizationId: new Types.ObjectId(organizationId) }).populate('branchId', 'name address');
  if (!service) throw new Error('Service not found');
  if (service.branchId && !canAccessBranch(user, service.branchId._id.toString())) throw new Error('You do not have access to this service branch');
  return service;
};

export const updateService = async (id: string, data: any, organizationId: string, user: IUser) => {
  if (!Types.ObjectId.isValid(id)) throw new Error('Invalid service ID format');
  const existing = await Service.findOne({ _id: new Types.ObjectId(id), organizationId: new Types.ObjectId(organizationId) });
  if (!existing) throw new Error('Service not found');
  if (existing.branchId && !canAccessBranch(user, existing.branchId.toString())) throw new Error('You do not have access to this service branch');
  const next: any = sanitizeUpdate(data);
  if (next.name !== undefined) { if (typeof next.name !== 'string' || !next.name.trim()) throw new Error('Service name is required'); next.name = next.name.trim(); }
  if (next.price !== undefined) { const p = Number(next.price); if (!Number.isFinite(p) || p < 0) throw new Error('Price must be >= 0'); next.price = p; }
  if (next.durationMinutes !== undefined) { const d = Number(next.durationMinutes); if (!Number.isFinite(d) || d <= 0) throw new Error('Duration must be > 0'); next.durationMinutes = d; }
  if (next.branchId !== undefined) next.branchId = await validateBranch(next.branchId, organizationId, user);
  for (const key of ['code', 'category', 'description']) if (next[key] !== undefined) next[key] = typeof next[key] === 'string' ? next[key].trim() || undefined : undefined;
  if (next.status !== undefined) next.status = validateStatus(next.status);
  let oldPublicId: string | undefined;
  if (typeof data.imageData === 'string' && data.imageData) { const uploaded = await uploadServiceImage(data.imageData, organizationId, id); next.imageUrl = uploaded.secureUrl; next.imagePublicId = uploaded.publicId; oldPublicId = existing.imagePublicId; }
  const service = await Service.findOneAndUpdate({ _id: new Types.ObjectId(id), organizationId: new Types.ObjectId(organizationId) }, { $set: next }, { new: true, runValidators: true }).populate('branchId', 'name address');
  if (oldPublicId && oldPublicId !== service?.imagePublicId) { try { await deleteServiceImage(oldPublicId); } catch (error) { console.error('Failed to delete old service image', error); } }
  return service;
};

export const deleteService = async (id: string, organizationId: string, user: IUser) => {
  const service = await getServiceById(id, organizationId, user);
  service.status = 'INACTIVE';
  await service.save();
  return { message: 'Service deactivated successfully', service };
};

export const removeServiceImage = async (id: string, organizationId: string, user: IUser) => {
  const service = await getServiceById(id, organizationId, user);
  if (service.imagePublicId) await deleteServiceImage(service.imagePublicId);
  service.imageUrl = undefined; service.imagePublicId = undefined; await service.save();
  return service;
};