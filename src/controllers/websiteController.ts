import { Request, Response } from 'express';
import Organization from '../models/Organization';
import * as websiteService from '../services/websiteService';

export const get = async (req: Request, res: Response) => {
  try {
    const config = await websiteService.getWebsiteConfig(req.user!);
    const organization = await Organization.findById(req.user!.organizationId).select('slug');
    res.json({ success: true, organizationSlug: organization?.slug || null, draft: config.draft, published: config.published, publishedAt: config.publishedAt || null });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const config = await websiteService.updateWebsiteDraft(req.body, req.user!);
    res.json({ success: true, draft: config.draft, published: config.published, publishedAt: config.publishedAt || null });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const publish = async (req: Request, res: Response) => {
  try {
    const config = await websiteService.publishWebsite(req.user!);
    res.json({ success: true, draft: config.draft, published: config.published, publishedAt: config.publishedAt || null });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};
