import { Types } from 'mongoose';
import Branch from '../models/Branch';
import { IUser } from '../models/User';
import { getAllowedBranchIds } from '../utils/branchAccess';

export const getBranches = async (organizationId: string, user: IUser) => {
  const allowedBranchIds = getAllowedBranchIds(user);
  const query: any = { organizationId };
  if (allowedBranchIds !== 'ALL') query._id = { $in: allowedBranchIds.map(id => new Types.ObjectId(id)) };
  return await Branch.find(query);
};

export const createBranch = async (data: any, organizationId: string) => {
  return await Branch.create({ ...data, organizationId });
};
