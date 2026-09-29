import { Request, Response } from 'express';
import * as branchService from '../services/branchService';

export const getAll = async (req: Request, res: Response) => {
  try {
    const branches = await branchService.getBranches(req.user!.organizationId.toString(), req.user!);
    res.json(branches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const branch = await branchService.createBranch(req.body, req.user!.organizationId.toString());
    res.status(201).json(branch);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};
