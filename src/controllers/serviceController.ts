import { Request, Response } from 'express';
import * as serviceService from '../services/serviceService';

export const create = async (req: Request, res: Response) => {
  try {
    const service = await serviceService.createService(req.body, req.user!.organizationId.toString(), req.user!);
    res.status(201).json({ success: true, service });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getAll = async (req: Request, res: Response) => {
  try {
    const result = await serviceService.getServices(req.user!.organizationId.toString(), req.query, req.user!);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const service = await serviceService.getServiceById(req.params.id, req.user!.organizationId.toString(), req.user!);
    res.json({ success: true, service });
  } catch (error) {
    res.status(404).json({ success: false, message: (error as Error).message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const service = await serviceService.updateService(req.params.id, req.body, req.user!.organizationId.toString(), req.user!);
    res.json({ success: true, service });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await serviceService.deleteService(req.params.id, req.user!.organizationId.toString(), req.user!);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};
