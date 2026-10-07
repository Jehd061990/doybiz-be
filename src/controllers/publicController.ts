import { Request, Response } from 'express';
import * as publicService from '../services/publicService';
import * as reservationService from '../services/reservationService';
import Organization from '../models/Organization';
import { isApprovedPlatformHost } from '../middlewares/tenantResolver';

const organization = (req: Request) => req.organization!;

export const getSite = async (req: Request, res: Response) => {
  try { res.json({ success: true, site: await publicService.getSite(organization(req)) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};

export const getBranches = async (req: Request, res: Response) => {
  try { res.json({ success: true, branches: await publicService.getBranches(organization(req)) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};

export const getServices = async (req: Request, res: Response) => {
  try { res.json({ success: true, services: await publicService.getServices(organization(req), req.query.branchId as string | undefined) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};

export const getStaff = async (req: Request, res: Response) => {
  try { res.json({ success: true, staff: await publicService.getStaff(organization(req), req.query.branchId as string | undefined, req.query.serviceId as string | undefined) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};

export const getAvailability = async (req: Request, res: Response) => {
  try { res.json({ success: true, availability: await publicService.getAvailability(organization(req), req.query) }); }
  catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};

export const createReservation = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, phone, email, notes, ...reservationData } = req.body;
    if (!firstName || !lastName || !phone) throw new Error('Customer first name, last name, and phone are required');
    const reservation = await reservationService.createPublicReservation(reservationData, organization(req)._id.toString(), { firstName, lastName, phone, email, notes });
    res.status(201).json({
      success: true,
      message: 'Reservation created successfully',
      confirmationReference: reservation.confirmationReference,
    });
  } catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); }
};

export const debugTenant = async (req: Request, res: Response) => {
  if (process.env.DOYBIZ_DEBUG_TENANT !== 'true') {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  const host = (req.header('host') || '').split(':')[0].toLowerCase().replace(/.$/, '');
  const queryTenant = typeof req.query.tenant === 'string' ? req.query.tenant.trim().toLowerCase() : null;
  const org = queryTenant
    ? await Organization.findOne({ slug: queryTenant, status: 'ACTIVE' }).select('_id name slug status')
    : null;

  return res.json({
    success: true,
    host,
    nodeEnvProduction: process.env.NODE_ENV === 'production',
    platformHostApproved: isApprovedPlatformHost(host),
    queryTenant,
    tenantFound: Boolean(org),
    tenantStatus: org?.status ?? null,
  });
};
