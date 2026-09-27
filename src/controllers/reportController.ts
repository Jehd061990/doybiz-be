import { Request, Response } from 'express';
import * as reportService from '../services/reportService';

const handle = (operation: (req: Request) => Promise<unknown>, status = 200) => async (req: Request, res: Response) => {
  try {
    const data = await operation(req);
    res.status(status).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const salesSummary = handle(req => reportService.getSalesSummary(req.user!, req.query));
export const dailySales = handle(req => reportService.getDailySales(req.user!, req.query));
export const monthlySales = handle(req => reportService.getMonthlySales(req.user!, req.query));
export const salesByBranch = handle(req => reportService.getSalesByBranch(req.user!, req.query));
export const salesByService = handle(req => reportService.getSalesByService(req.user!, req.query));
export const salesByCashier = handle(req => reportService.getSalesByCashier(req.user!, req.query));
export const paymentsByMethod = handle(req => reportService.getPaymentsByMethod(req.user!, req.query));
export const paymentsSummary = handle(req => reportService.getPaymentSummary(req.user!, req.query));
export const reservationsSummary = handle(req => reportService.getReservationSummary(req.user!, req.query));
export const customersSummary = handle(req => reportService.getCustomerSummary(req.user!, req.query));
export const topServices = handle(req => reportService.getTopServices(req.user!, req.query));
export const dashboardSummary = handle(req => reportService.getDashboardSummary(req.user!, req.query));