import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { canAccessBranch, canAccessModule } from '../utils/branchAccess';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string };
    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Invalid or inactive user' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const authorizeRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized role access' });
    }
    next();
  };
};

export const authorizeModule = (moduleName: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const modules = Array.isArray(moduleName) ? moduleName : [moduleName];
    const isAllowed = modules.some(item => canAccessModule(req.user, item));
    if (!isAllowed) {
      return res.status(403).json({ success: false, message: 'Module access denied' });
    }
    next();
  };
};

export const authorizeBranchAccess = (branchIdParam = 'branchId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const branchId = req.params[branchIdParam] || req.body?.branchId || req.query?.branchId;
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'Branch ID is required' });
    }
    if (!canAccessBranch(req.user, String(branchId))) {
      return res.status(403).json({ success: false, message: 'Branch access denied' });
    }
    next();
  };
};
