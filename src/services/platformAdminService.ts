import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import Organization from '../models/Organization';
import Branch from '../models/Branch';
import * as userService from './userService';

export const listOrganizations = async () => {
  return Organization.find({}).sort({ createdAt: -1 });
};

export const createOrganization = async (data: any) => {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const phone = typeof data.phone === 'string' ? data.phone.trim() : '';
  const address = typeof data.address === 'string' ? data.address.trim() : '';
  const slug = typeof data.slug === 'string' && data.slug.trim() ? data.slug.trim().toLowerCase() : undefined;
  if (!name || !email || !phone || !address) throw new Error('name, email, phone, and address are required');
  return Organization.create({ name, email, phone, address, ...(slug ? { slug } : {}) });
};

export const updateOrganization = async (organizationId: string, data: any) => {
  const orgId = validateOrganizationId(organizationId);
  const organization = await Organization.findById(orgId);
  if (!organization) throw new Error('Organization not found');

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const phone = typeof data.phone === 'string' ? data.phone.trim() : '';
  const address = typeof data.address === 'string' ? data.address.trim() : '';
  const slug = typeof data.slug === 'string' && data.slug.trim() ? data.slug.trim().toLowerCase() : undefined;
  const status = data.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

  if (!name || !email || !phone || !address) throw new Error('name, email, phone, and address are required');

  organization.name = name;
  organization.email = email;
  organization.phone = phone;
  organization.address = address;
  organization.status = status;
  organization.slug = slug;
  await organization.save();
  return organization;
};

const validateOrganizationId = (organizationId: string) => {
  if (!Types.ObjectId.isValid(organizationId)) throw new Error('Invalid organization ID');
  return new Types.ObjectId(organizationId);
};

export const listBranches = async (organizationId: string) => {
  const orgId = validateOrganizationId(organizationId);
  return Branch.find({ organizationId: orgId }).sort({ createdAt: 1 });
};

export const createBranch = async (organizationId: string, data: any) => {
  const orgId = validateOrganizationId(organizationId);
  const organization = await Organization.findById(orgId);
  if (!organization) throw new Error('Organization not found');
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const address = typeof data.address === 'string' ? data.address.trim() : '';
  const contactNumber = typeof data.contactNumber === 'string' ? data.contactNumber.trim() : '';
  if (!name || !address || !contactNumber) throw new Error('name, address, and contactNumber are required');
  return Branch.create({ organizationId: orgId, name, address, contactNumber, status: data.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' });
};

export const listUsers = async (organizationId: string) => {
  const orgId = validateOrganizationId(organizationId);
  return userService.listOrganizationUsers(orgId);
};

export const createUser = async (organizationId: string, data: any) => {
  const orgId = validateOrganizationId(organizationId);
  const organization = await Organization.findById(orgId);
  if (!organization) throw new Error('Organization not found');
  return userService.createOrganizationUser(orgId, data);
};
