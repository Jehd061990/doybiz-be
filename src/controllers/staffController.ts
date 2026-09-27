import { Request, Response } from 'express';
import * as staffService from '../services/staffService';

export const create = async (req: Request, res: Response) => {
  try {
    const staff = await staffService.createStaff(req.body, req.user!.organizationId.toString(), req.user!);
    res.status(201).json({ success: true, staff });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getAll = async (req: Request, res: Response) => {
  try {
    const result = await staffService.getStaff(req.user!.organizationId.toString(), req.query, req.user!);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const staff = await staffService.getStaffById(req.params.id, req.user!.organizationId.toString(), req.user!);
    res.json({ success: true, staff });
  } catch (error) {
    res.status(404).json({ success: false, message: (error as Error).message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const staff = await staffService.updateStaff(req.params.id, req.body, req.user!.organizationId.toString(), req.user!);
    res.json({ success: true, staff });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await staffService.deleteStaff(req.params.id, req.user!.organizationId.toString(), req.user!);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const assignService = async (req: Request, res: Response) => {
  try {
    const { staffId, serviceId } = req.params;
    const assignment = await staffService.assignServiceToStaff(staffId, serviceId, req.user!.organizationId.toString(), req.user!);
    res.status(201).json({ success: true, assignment });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const unassignService = async (req: Request, res: Response) => {
  try {
    const { staffId, serviceId } = req.params;
    const result = await staffService.unassignServiceFromStaff(staffId, serviceId, req.user!.organizationId.toString(), req.user!);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getServices = async (req: Request, res: Response) => {
  try {
    const services = await staffService.getStaffServicesList(req.params.staffId, req.user!.organizationId.toString(), req.user!);
    res.json({ success: true, services });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};
