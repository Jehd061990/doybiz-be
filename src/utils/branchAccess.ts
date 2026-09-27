import { Types } from 'mongoose';
import { IUser } from '../models/User';

export const canAccessBranch = (user: IUser, branchId: string | Types.ObjectId): boolean => {
  if (user.role === 'OWNER') {
    return true;
  }

  if (user.branchAccess === 'ALL') {
    return true;
  }

  if (Array.isArray(user.branchAccess)) {
    const target = branchId.toString();
    return user.branchAccess.some((b) => b.toString() === target);
  }

  return false;
};

export const getAllowedBranchIds = (user: IUser): string[] | 'ALL' => {
  if (user.role === 'OWNER' || user.branchAccess === 'ALL') {
    return 'ALL';
  }

  if (Array.isArray(user.branchAccess)) {
    return user.branchAccess.map((b) => b.toString());
  }

  return [];
};
