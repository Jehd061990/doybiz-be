import { Request, Response } from 'express';
import * as userService from '../services/userService';

const handleError = (res: Response, error: unknown) => {
  const message = (error as Error).message;
  res.status(message.includes('not found') ? 404 : 400).json({ success: false, message });
};

export const list = async (req: Request, res: Response) => {
  try {
    const users = await userService.listOrganizationUsers(req.user!.organizationId);
    res.json({ success: true, users });
  } catch (error) {
    handleError(res, error);
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const user = await userService.getOrganizationUser(req.user!.organizationId, req.params.id);
    res.json({ success: true, user });
  } catch (error) {
    handleError(res, error);
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const user = await userService.createOrganizationUser(req.user!.organizationId, req.body);
    res.status(201).json({ success: true, user });
  } catch (error) {
    handleError(res, error);
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const user = await userService.updateOrganizationUser(req.user!.organizationId, req.params.id, req.body);
    res.json({ success: true, user });
  } catch (error) {
    handleError(res, error);
  }
};
