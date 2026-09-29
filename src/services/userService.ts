import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import Branch from '../models/Branch';
import User, { ModulePermissionName, PermissionPreset, UserRole, VALID_MODULES, VALID_ROLES } from '../models/User';
import { applyRolePreset } from '../utils/rolePermissions';

const validPresets: PermissionPreset[] = ['OWNER', 'MANAGER', 'CASHIER'];

const validateRole = (value: unknown): UserRole => {
  if (typeof value !== 'string' || !VALID_ROLES.includes(value as UserRole)) throw new Error('Invalid user role');
  return value as UserRole;
};

const validateStatus = (value: unknown): 'ACTIVE' | 'INACTIVE' => {
  if (value !== 'ACTIVE' && value !== 'INACTIVE') throw new Error('Status must be ACTIVE or INACTIVE');
  return value;
};

const validatePreset = (value: unknown, role: UserRole): PermissionPreset => {
  const preset = value === undefined ? role : value;
  if (typeof preset !== 'string' || !validPresets.includes(preset as PermissionPreset)) throw new Error('Invalid permission preset');
  if (preset === 'OWNER' && role !== 'OWNER') throw new Error('OWNER preset is only valid for OWNER role');
  return preset as PermissionPreset;
};

const validateModulePermissions = (value: unknown): ModulePermissionName[] => {
  if (!Array.isArray(value)) throw new Error('modulePermissions must be an array');
  const permissions: ModulePermissionName[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') throw new Error('Each module permission must be a string');
    const moduleName = entry.trim().toUpperCase();
    if (!VALID_MODULES.includes(moduleName as ModulePermissionName)) throw new Error(`Invalid module permission: ${entry}`);
    if (!permissions.includes(moduleName as ModulePermissionName)) permissions.push(moduleName as ModulePermissionName);
  }
  return permissions;
};

const validateBranchAccess = async (value: unknown, orgId: Types.ObjectId, role: UserRole): Promise<string[] | 'ALL'> => {
  if (value === 'ALL') {
    if (role !== 'OWNER') throw new Error('ALL branch access is only valid for OWNER role');
    return 'ALL';
  }
  if (!Array.isArray(value)) throw new Error('branchAccess must be an array of branch IDs');
  const branchIds = Array.from(new Set(value.map(entry => {
    const id = typeof entry === 'string' ? entry : String(entry);
    if (!Types.ObjectId.isValid(id)) throw new Error(`Invalid branch ID: ${id}`);
    return id;
  })));
  const branches = await Branch.countDocuments({ organizationId: orgId, _id: { $in: branchIds.map(id => new Types.ObjectId(id)) } });
  if (branches !== branchIds.length) throw new Error('One or more branches do not belong to this organization');
  return branchIds;
};

const safeUser = (user: any) => {
  const result = user.toObject ? user.toObject() : user;
  delete result.passwordHash;
  return result;
};

export const listOrganizationUsers = async (orgId: Types.ObjectId) => {
  const users = await User.find({ organizationId: orgId }).sort({ createdAt: 1 });
  return users.map(safeUser);
};

export const getOrganizationUser = async (orgId: Types.ObjectId, userId: string) => {
  if (!Types.ObjectId.isValid(userId)) throw new Error('Invalid user ID');
  const user = await User.findOne({ _id: userId, organizationId: orgId });
  if (!user) throw new Error('User not found in this organization');
  return safeUser(user);
};

export const createOrganizationUser = async (orgId: Types.ObjectId, data: any) => {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const password = typeof data.password === 'string' ? data.password : '';
  if (!name || !email || password.length < 8) throw new Error('name, email, and a password of at least 8 characters are required');
  const role = validateRole(data.role);
  const permissionPreset = validatePreset(data.permissionPreset, role);
  const branchAccess = await validateBranchAccess(data.branchAccess === undefined ? (role === 'OWNER' ? 'ALL' : []) : data.branchAccess, orgId, role);
  const modulePermissions = data.modulePermissions === undefined ? undefined : validateModulePermissions(data.modulePermissions);
  const status = data.status === undefined ? 'ACTIVE' : validateStatus(data.status);
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    organizationId: orgId,
    name,
    email,
    passwordHash,
    role,
    branchAccess,
    permissionPreset,
    ...(modulePermissions === undefined ? {} : { modulePermissions }),
    status,
  });
  return safeUser(user);
};

export const updateOrganizationUser = async (orgId: Types.ObjectId, userId: string, data: any) => {
  if (!Types.ObjectId.isValid(userId)) throw new Error('Invalid user ID');
  const user = await User.findOne({ _id: userId, organizationId: orgId });
  if (!user) throw new Error('User not found in this organization');

  const role = data.role === undefined ? user.role : validateRole(data.role);
  const status = data.status === undefined ? user.status : validateStatus(data.status);
  const storedPreset = data.permissionPreset === undefined ? user.permissionPreset : data.permissionPreset;
  const permissionPreset = validatePreset(storedPreset === 'OWNER' && role !== 'OWNER' ? role : storedPreset, role);

  const willRemoveActiveOwner = user.role === 'OWNER' && user.status === 'ACTIVE' && (role !== 'OWNER' || status !== 'ACTIVE');
  if (willRemoveActiveOwner) {
    const activeOwners = await User.countDocuments({ organizationId: orgId, role: 'OWNER', status: 'ACTIVE' });
    if (activeOwners <= 1) throw new Error('The organization must retain at least one active owner');
  }

  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || !data.name.trim()) throw new Error('name must be a non-empty string');
    user.name = data.name.trim();
  }
  if (data.email !== undefined) {
    if (typeof data.email !== 'string' || !data.email.trim()) throw new Error('email must be a non-empty string');
    user.email = data.email.trim().toLowerCase();
  }
  if (data.role !== undefined) user.role = role;
  if (data.status !== undefined) user.status = status;
  if (data.branchAccess !== undefined) user.branchAccess = await validateBranchAccess(data.branchAccess, orgId, role);
  else if (role !== 'OWNER' && user.branchAccess === 'ALL') throw new Error('Assign organization branch IDs before changing this user from OWNER');
  if (data.permissionPreset !== undefined || data.role !== undefined) user.permissionPreset = permissionPreset;

  if (data.applyPreset === true) {
    user.modulePermissions = applyRolePreset(role, permissionPreset) as ModulePermissionName[];
  } else if (data.modulePermissions !== undefined) {
    user.modulePermissions = validateModulePermissions(data.modulePermissions);
  }

  await user.save();
  return safeUser(user);
};
