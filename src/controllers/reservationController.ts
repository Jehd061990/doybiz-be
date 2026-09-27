import { Request, Response } from 'express';
import * as reservationService from '../services/reservationService';

export const create = async (req: Request, res: Response) => {
  try {
    const reservation = await reservationService.createReservation(req.body, req.user!.organizationId.toString(), req.user!);
    res.status(201).json({ success: true, reservation, data: reservation });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getAll = async (req: Request, res: Response) => {
  try {
    const result = await reservationService.getReservations(req.user!.organizationId.toString(), req.query, req.user!);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const reservation = await reservationService.getReservationById(req.params.id, req.user!.organizationId.toString(), req.user!);
    res.json({ success: true, reservation, data: reservation });
  } catch (error) {
    res.status(404).json({ success: false, message: (error as Error).message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const reservation = await reservationService.updateReservation(req.params.id, req.body, req.user!.organizationId.toString(), req.user!);
    res.json({ success: true, reservation, data: reservation });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await reservationService.deleteReservation(req.params.id, req.user!.organizationId.toString(), req.user!);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};
