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

export const createXenditPaymentRequest = async (req: Request, res: Response) => {
  try { res.status(201).json({ success: true, ...await billingService.createXenditPaymentRequest(req.params.id, req.user!, req.body) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};

export const handleXenditWebhook = async (req: Request, res: Response) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const payload = rawBody.length > 0 ? JSON.parse(rawBody.toString('utf8')) : {};
    const result = await billingService.reconcileXenditWebhook(payload, req.headers as Record<string, any>);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    const message = (error as Error).message;
    if (/x-callback-token|not configured|invalid|missi|amount|Unsupported|reconcile/i.test(message)) {
      return res.status(401).json({ success: false, message });
    }
    res.status(400).json({ success: false, message });
  }
};

export const createAdjustment = async (req: Request, res: Response) => {
  try { res.status(201).json({ success: true, billing: await billingService.createMidTermAdjustment(req.user!, req.body) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};