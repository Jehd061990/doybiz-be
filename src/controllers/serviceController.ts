import { Request, Response } from 'express';
import * as serviceService from '../services/serviceService';

const handleError = (res: Response, error: unknown, status = 400) => res.status(status).json({ success: false, message: (error as Error).message });

export const create = async (req: Request, res: Response) => {
  try { res.status(201).json({ success: true, service: await serviceService.createService(req.body, req.user!.organizationId.toString(), req.user!) }); }
  catch (error) { handleError(res, error); }
};

export const getAll = async (req: Request, res: Response) => {
  try { res.json({ success: true, ...(await serviceService.getServices(req.user!.organizationId.toString(), req.query, req.user!)) }); }
  catch (error) { handleError(res, error); }
};

export const getById = async (req: Request, res: Response) => {
  try { res.json({ success: true, service: await serviceService.getServiceById(req.params.id, req.user!.organizationId.toString(), req.user!) }); }
  catch (error) { handleError(res, error, 404); }
};

export const update = async (req: Request, res: Response) => {
  try { res.json({ success: true, service: await serviceService.updateService(req.params.id, req.body, req.user!.organizationId.toString(), req.user!) }); }
  catch (error) { handleError(res, error); }
};

export const remove = async (req: Request, res: Response) => {
  try { res.json({ success: true, ...(await serviceService.deleteService(req.params.id, req.user!.organizationId.toString(), req.user!)) }); }
  catch (error) { handleError(res, error); }
};

export const removeImage = async (req: Request, res: Response) => {
  try { res.json({ success: true, service: await serviceService.removeServiceImage(req.params.id, req.user!.organizationId.toString(), req.user!) }); }
  catch (error) { handleError(res, error); }
};
