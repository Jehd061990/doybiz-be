import { Types } from 'mongoose';
import Branch from '../models/Branch';
import Organization from '../models/Organization';
import User from '../models/User';

export const DEFAULT_INCLUDED_BRANCHES = 1;
export const DEFAULT_INCLUDED_USER_SEATS = 3;
export const DEFAULT_USERS_PER_ADDITIONAL_BRANCH = 3;

export const getProvisioning = (organization: {
  includedBranchCount?: number;
  includedUserSeats?: number;
  additionalUserSeatsPerBranch?: number;
  additionalUserSeats?: number;
}) => ({
  includedBranchCount: Number.isFinite(organization.includedBranchCount)
    ? Math.max(0, Math.floor(organization.includedBranchCount as number))
    : DEFAULT_INCLUDED_BRANCHES,
  includedUserSeats: Number.isFinite(organization.includedUserSeats)
    ? Math.max(0, Math.floor(organization.includedUserSeats as number))
    : DEFAULT_INCLUDED_USER_SEATS,
  additionalUserSeatsPerBranch: Number.isFinite(organization.additionalUserSeatsPerBranch)
    ? Math.max(0, Math.floor(organization.additionalUserSeatsPerBranch as number))
    : DEFAULT_USERS_PER_ADDITIONAL_BRANCH,
  additionalUserSeats: Number.isFinite(organization.additionalUserSeats)
    ? Math.max(0, Math.floor(organization.additionalUserSeats as number))
    : 0,
});

export const getActiveSeatSummary = async (organizationId: Types.ObjectId) => {
  const organization = await Organization.findById(organizationId).select(
    'includedBranchCount includedUserSeats additionalUserSeatsPerBranch additionalUserSeats',
  );
  if (!organization) throw new Error('Organization not found');

  const provisioning = getProvisioning(organization);
  const activeBranches = await Branch.countDocuments({
    organizationId,
    status: 'ACTIVE',
    billingActivationPending: { $ne: true },
  });
  const activeUsers = await User.countDocuments({
    organizationId,
    status: 'ACTIVE',
    billingActivationPending: { $ne: true },
  });

  const branchBasedUserSeats =
    provisioning.includedUserSeats +
    Math.max(0, activeBranches - provisioning.includedBranchCount) *
      provisioning.additionalUserSeatsPerBranch;
  const includedUserSeats = branchBasedUserSeats + provisioning.additionalUserSeats;

  return {
    activeBranches,
    activeUsers,
    includedBranchCount: provisioning.includedBranchCount,
    includedUserSeats,
    configuredIncludedUserSeats: provisioning.includedUserSeats,
    additionalUserSeatsPerBranch: provisioning.additionalUserSeatsPerBranch,
    additionalUserSeats: provisioning.additionalUserSeats,
    branchBasedUserSeats,
    availableSeats: Math.max(0, includedUserSeats - activeUsers),
    additionalUserCount: Math.max(0, activeUsers - includedUserSeats),
  };
};

export const assertActiveUserCapacity = async (
  organizationId: Types.ObjectId,
  additionalActiveUsers = 1,
) => {
  if (additionalActiveUsers <= 0) return getActiveSeatSummary(organizationId);

  const summary = await getActiveSeatSummary(organizationId);
  const projectedActiveUsers = summary.activeUsers + additionalActiveUsers;
  if (projectedActiveUsers > summary.includedUserSeats) {
    throw new Error(
      `Organization has reached its included user seat limit (${summary.includedUserSeats}). Add another branch or have a Super Admin provision additional user seats.`,
    );
  }
  return summary;
};
