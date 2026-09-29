import { Request, Response } from 'express';
import { IOrganization } from '../models/Organization';
import { IUser } from '../models/User';
import * as authService from '../services/authService';

const publicUser = (user: IUser) => ({
  _id: user._id.toString(),
  organizationId: user.organizationId.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  branchAccess: user.branchAccess,
  modulePermissions: user.modulePermissions,
  permissionPreset: user.permissionPreset,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const publicOrganization = (organization: IOrganization) => ({
  _id: organization._id.toString(),
  name: organization.name,
  slug: organization.slug,
  email: organization.email,
  phone: organization.phone,
  address: organization.address,
  status: organization.status,
  createdAt: organization.createdAt,
  updatedAt: organization.updatedAt,
});

export const register = async (req: Request, res: Response) => {
  try {
    const { org, user, token } = await authService.registerOrganization(req.body);
    res.status(201).json({
      success: true,
      org: publicOrganization(org),
      user: publicUser(user),
      token,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { user, token } = await authService.login(req.body);
    res.status(200).json({
      success: true,
      user: publicUser(user),
      token,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};
