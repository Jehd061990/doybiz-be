import { Request, Response } from 'express';
import * as reservationService from '../services/reservationService';

export const createPublicReservation = async (req: Request, res: Response) => {
  try {
    const orgId = req.organization!._id.toString();
    const { firstName, lastName, phone, email, notes, ...reservationData } = req.body;

    if (!firstName || !lastName || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Customer first name, last name, and phone are required for public reservations',
      });
    }

    const customerData = { firstName, lastName, phone, email, notes };
    const reservation = await reservationService.createPublicReservation(reservationData, orgId, customerData);

    res.status(201).json({
      success: true,
      message: 'Reservation created successfully',
      confirmationReference: reservation.confirmationReference,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: (error as Error).message,
    });
  }
};
