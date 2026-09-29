import { Types } from 'mongoose';
import { IUser } from '../models/User';
import { hasModuleAccess } from './rolePermissions';

export const normalizeBranchAccess = (value: unknown): string[] => {
  if (value === 'ALL') return [];
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    const id = String(entry).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
};

export const canAccessBranch = (user: IUser, branchId: string | Types.ObjectId): boolean => {
  if (user.role === 'OWNER') {
    return true;
  }

  const allowed = normalizeBranchAccess(user.branchAccess);
  const target = branchId.toString();
  return allowed.some((b) => b.toString() === target);
};

export const getAllowedBranchIds = (user: IUser): string[] | 'ALL' => {
  if (user.role === 'OWNER') {
    return 'ALL';
  }

  return normalizeBranchAccess(user.branchAccess);
};

export const canAccessModule = (user: IUser | null | undefined, moduleName: string): boolean => {
  return hasModuleAccess(user, moduleName);
};

export const hasAnyModuleAccess = (user: IUser | null | undefined, modules: string[]) => modules.some(module => canAccessModule(user, module));


