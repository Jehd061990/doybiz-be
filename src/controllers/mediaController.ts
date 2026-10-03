import { Request, Response } from 'express';
import * as mediaService from '../services/mediaService';

const organizationId = (req: Request) => req.user!.organizationId;

export const list = async (req: Request, res: Response) => {
  try {
    const assets = await mediaService.getMediaAssets(organizationId(req));
    res.json({ success: true, assets });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const upload = async (req: Request, res: Response) => {
  try {
    if (!req.file) throw new Error('Image file is required');
    const asset = await mediaService.saveImage(organizationId(req), {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      buffer: req.file.buffer,
    });
    res.status(201).json({ success: true, asset });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    await mediaService.deleteMediaAsset(organizationId(req), req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};
