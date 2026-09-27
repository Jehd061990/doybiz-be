import { Request, Response } from 'express';
import * as customerService from '../services/customerService';

export const create = async (req: Request, res: Response) => {
  try {
    const customer = await customerService.createCustomer(req.body, req.user!.organizationId.toString());
    res.status(201).json({ success: true, customer });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getAll = async (req: Request, res: Response) => {
  try {
    const result = await customerService.getCustomers(req.user!.organizationId.toString(), req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const customer = await customerService.getCustomerById(req.params.id, req.user!.organizationId.toString());
    res.json({ success: true, customer });
  } catch (error) {
    res.status(404).json({ success: false, message: (error as Error).message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const customer = await customerService.updateCustomer(req.params.id, req.body, req.user!.organizationId.toString());
    res.json({ success: true, customer });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await customerService.deleteCustomer(req.params.id, req.user!.organizationId.toString());
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};
