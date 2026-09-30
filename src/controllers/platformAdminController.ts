import { Request, Response } from 'express';
import * as platformAdminService from '../services/platformAdminService';

const handleError = (res: Response, error: unknown) => {
  const message = (error as Error).message;
  const status = message.includes('not found') ? 404 : 400;
  res.status(status).json({ success: false, message });
};

export const listOrganizations = async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, organizations: await platformAdminService.listOrganizations() });
  } catch (error) {
    handleError(res, error);
  }
};

export const createOrganization = async (req: Request, res: Response) => {
  try {
    res.status(201).json({ success: true, organization: await platformAdminService.createOrganization(req.body) });
  } catch (error) {
    handleError(res, error);
  }
};

export const listBranches = async (req: Request, res: Response) => {
  try {
    res.json({ success: true, branches: await platformAdminService.listBranches(req.params.organizationId) });
  } catch (error) {
    handleError(res, error);
  }
};

export const createBranch = async (req: Request, res: Response) => {
  try {
    res.status(201).json({ success: true, branch: await platformAdminService.createBranch(req.params.organizationId, req.body) });
  } catch (error) {
    handleError(res, error);
  }
};

export const listUsers = async (req: Request, res: Response) => {
  try {
    res.json({ success: true, users: await platformAdminService.listUsers(req.params.organizationId) });
  } catch (error) {
    handleError(res, error);
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    res.status(201).json({ success: true, user: await platformAdminService.createUser(req.params.organizationId, req.body) });
  } catch (error) {
    handleError(res, error);
  }
};
