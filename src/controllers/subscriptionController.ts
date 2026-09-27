import { Request, Response } from 'express';
import * as billingService from '../services/billingService';

const ownerOrganizationId = (req: Request) => req.user!.organizationId.toString();

export const getSubscription = async (req: Request, res: Response) => {
  try { res.json({ success: true, subscription: await billingService.getSubscription(req.user!) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};

export const getPlan = async (_req: Request, res: Response) => {
  try { res.json({ success: true, plan: await billingService.getPlan() }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};

export const getEstimate = async (req: Request, res: Response) => {
  try { res.json({ success: true, estimate: await billingService.calculateEstimate(req.user!) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};

export const activate = async (req: Request, res: Response) => {
  try { res.status(201).json({ success: true, ...await billingService.activateSubscription(req.user!, req.body) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};

export const cancel = async (req: Request, res: Response) => {
  try { res.json({ success: true, subscription: await billingService.cancelSubscription(req.user!) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};