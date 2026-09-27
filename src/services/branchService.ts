import Branch from '../models/Branch';

export const getBranches = async (organizationId: string) => {
  return await Branch.find({ organizationId });
};

export const createBranch = async (data: any, organizationId: string) => {
  return await Branch.create({ ...data, organizationId });
};
