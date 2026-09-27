import { Request, Response } from 'express';
import * as saleService from '../services/saleService';
import * as paymentService from '../services/paymentService';

const organizationId = (req: Request) => req.user!.organizationId.toString();

export const create = async (req: Request, res: Response) => {
  try {
    const sale = await saleService.createSale(req.body, organizationId(req), req.user!);
    res.status(201).json({ success: true, sale });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const createFromReservation = async (req: Request, res: Response) => {
  try {
    const sale = await saleService.createSaleFromReservation(req.params.reservationId, organizationId(req), req.user!);
    res.status(201).json({ success: true, sale });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getAll = async (req: Request, res: Response) => {
  try {
    const result = await saleService.getSales(organizationId(req), req.query, req.user!);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const result = await saleService.getSaleById(req.params.id, organizationId(req), req.user!);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(404).json({ success: false, message: (error as Error).message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const sale = await saleService.updateSale(req.params.id, req.body, organizationId(req), req.user!);
    res.json({ success: true, sale });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await saleService.deleteSale(req.params.id, organizationId(req), req.user!);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const voidSale = async (req: Request, res: Response) => {
  try {
    const sale = await saleService.voidSale(req.params.saleId, req.body.reason, organizationId(req), req.user!);
    res.json({ success: true, sale });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const addPayment = async (req: Request, res: Response) => {
  try {
    const result = await paymentService.createPayment(req.params.saleId, req.body, organizationId(req), req.user!);
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getPayments = async (req: Request, res: Response) => {
  try {
    const payments = await paymentService.getPayments(req.params.saleId, organizationId(req), req.user!);
    res.json({ success: true, payments });
  } catch (error) {
    res.status(404).json({ success: false, message: (error as Error).message });
  }
};

export const getReceipt = async (req: Request, res: Response) => {
  try {
    const receipt = await saleService.getReceipt(req.params.saleId, organizationId(req), req.user!);
    res.json({ success: true, receipt });
  } catch (error) {
    res.status(404).json({ success: false, message: (error as Error).message });
  }
};