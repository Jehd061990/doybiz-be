import { Request, Response } from 'express';
import * as billingService from '../services/billingService';

export const getAll = async (req: Request, res: Response) => {
  try { res.json({ success: true, billing: await billingService.getBillingRecords(req.user!) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};

export const generate = async (req: Request, res: Response) => {
  try { res.status(201).json({ success: true, billing: await billingService.generateSubscriptionInvoice(req.user!) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};

export const getById = async (req: Request, res: Response) => {
  try { res.json({ success: true, ...await billingService.getBillingRecord(req.params.id, req.user!) }); }
  catch (error) { res.status(404).json({ success: false, message: (error as Error).message }); }
};

export const getPayments = async (req: Request, res: Response) => {
  try { res.json({ success: true, payments: await billingService.getBillingPayments(req.params.id, req.user!) }); }
  catch (error) { res.status(404).json({ success: false, message: (error as Error).message }); }
};

export const createPayment = async (req: Request, res: Response) => {
  try { res.status(201).json({ success: true, ...await billingService.recordBillingPayment(req.params.id, req.body, req.user!) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};

export const createAdjustment = async (req: Request, res: Response) => {
  try { res.status(201).json({ success: true, billing: await billingService.createMidTermAdjustment(req.user!, req.body) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};