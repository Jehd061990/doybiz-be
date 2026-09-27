import Customer, { ICustomer } from '../models/Customer';
import { Types } from 'mongoose';

export const createCustomer = async (data: any, organizationId: string) => {
  const { firstName, lastName, phone, email, address, notes, status } = data;
  if (!firstName || !lastName || !phone) {
    throw new Error('First name, last name, and phone are required');
  }

  return await Customer.create({
    organizationId: new Types.ObjectId(organizationId),
    firstName,
    lastName,
    phone,
    email,
    address,
    notes,
    status: status || 'ACTIVE',
  });
};

export const getCustomers = async (organizationId: string, queryParams: any = {}) => {
  const { search, phone, status, page = 1, limit = 10 } = queryParams;
  const query: any = { organizationId: new Types.ObjectId(organizationId) };

  if (status) {
    query.status = status;
  }

  if (phone) {
    query.phone = { $regex: phone, $options: 'i' };
  }

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    query.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { phone: searchRegex },
      { email: searchRegex },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await Promise.all([
    Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Customer.countDocuments(query),
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

export const getCustomerById = async (id: string, organizationId: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Invalid customer ID format');
  }
  const customer = await Customer.findOne({
    _id: new Types.ObjectId(id),
    organizationId: new Types.ObjectId(organizationId),
  });
  if (!customer) {
    throw new Error('Customer not found');
  }
  return customer;
};

export const updateCustomer = async (id: string, data: any, organizationId: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Invalid customer ID format');
  }
  const customer = await Customer.findOneAndUpdate(
    { _id: new Types.ObjectId(id), organizationId: new Types.ObjectId(organizationId) },
    { $set: data },
    { new: true, runValidators: true }
  );
  if (!customer) {
    throw new Error('Customer not found');
  }
  return customer;
};

export const deleteCustomer = async (id: string, organizationId: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Invalid customer ID format');
  }
  // Soft delete preferred
  const customer = await Customer.findOneAndUpdate(
    { _id: new Types.ObjectId(id), organizationId: new Types.ObjectId(organizationId) },
    { $set: { status: 'INACTIVE' } },
    { new: true }
  );
  if (!customer) {
    throw new Error('Customer not found');
  }
  return { message: 'Customer deactivated successfully', customer };
};
