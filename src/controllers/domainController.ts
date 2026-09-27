import { Request, Response } from 'express';
import * as domainService from '../services/domainService';

export const getAll = async (req: Request, res: Response) => {
  try { res.json({ success: true, domains: await domainService.getDomains(req.user!) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};

export const create = async (req: Request, res: Response) => {
  try { res.status(201).json({ success: true, domain: await domainService.createDomain(req.body, req.user!) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};

export const update = async (req: Request, res: Response) => {
  try { res.json({ success: true, domain: await domainService.updateDomain(req.params.id, req.body, req.user!) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};