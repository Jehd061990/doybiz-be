import { Types } from 'mongoose';
import Domain, { DomainStatus } from '../models/Domain';
import { IUser } from '../models/User';

const normalizeDomain = (value: unknown) => {
  if (typeof value !== 'string') throw new Error('Domain is required');
  const domain = value.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0].replace(/^www\./, '').replace(/\.$/, '');
  if (!domain || domain.includes(' ') || !domain.includes('.')) throw new Error('Invalid domain format');
  return domain;
};

export const getDomains = async (user: IUser) => Domain.find({ organizationId: user.organizationId }).sort({ isPrimary: -1, createdAt: 1 });

export const createDomain = async (data: any, user: IUser) => {
  const domain = normalizeDomain(data.domain);
  const existing = await Domain.findOne({ domain });
  if (existing) throw new Error('Domain is already assigned to an organization');
  const isPrimary = data.isPrimary === true;
  if (isPrimary) await Domain.updateMany({ organizationId: user.organizationId, type: 'LANDING_PAGE' }, { $set: { isPrimary: false } });
  return Domain.create({ domain, organizationId: user.organizationId, type: 'LANDING_PAGE', status: 'PENDING', isPrimary });
};

export const updateDomain = async (id: string, data: any, user: IUser) => {
  if (!Types.ObjectId.isValid(id)) throw new Error('Invalid domain ID format');
  const domain = await Domain.findOne({ _id: new Types.ObjectId(id), organizationId: user.organizationId });
  if (!domain) throw new Error('Domain not found');
  if (data.status && !['PENDING', 'ACTIVE', 'DISABLED'].includes(data.status)) throw new Error('Invalid domain status');
  const verifiedAt = data.verifiedAt ? new Date(data.verifiedAt) : domain.verifiedAt;
  if (data.status === 'ACTIVE' && !verifiedAt) throw new Error('Domain must be verified before activation');
  if (data.isPrimary === true) await Domain.updateMany({ organizationId: user.organizationId, type: 'LANDING_PAGE', _id: { $ne: domain._id } }, { $set: { isPrimary: false } });
  if (data.status) domain.status = data.status as DomainStatus;
  if (data.isPrimary !== undefined) domain.isPrimary = Boolean(data.isPrimary);
  if (data.verifiedAt) {
    if (Number.isNaN(verifiedAt!.getTime())) throw new Error('Invalid verification date');
    domain.verifiedAt = verifiedAt;
  }
  return domain.save();
};