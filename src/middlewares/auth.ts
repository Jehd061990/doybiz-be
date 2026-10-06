import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { canAccessBranch, canAccessModule } from '../utils/branchAccess';
import { getJwtSecret } from '../config/env';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      platformAdmin?: { email: string; role: 'PLATFORM_ADMIN' };
    }
  }
}

const getBearerToken = (req: Request) => {
  const authHeader = req.header('Authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
};

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId?: string; scope?: string };
    if (decoded.scope === 'PLATFORM_ADMIN' || !decoded.userId) {
      return res.status(401).json({ success: false, message: 'Organization authentication required' });
    }
    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Invalid or inactive user' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const authenticatePlatformAdmin = (req: Request, res: Response, next: NextFunction) => {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { scope?: string; role?: string; email?: string };
    if (decoded.scope !== 'PLATFORM_ADMIN' || decoded.role !== 'PLATFORM_ADMIN' || !decoded.email) {
      return res.status(403).json({ success: false, message: 'Platform admin access required' });
    }
    req.platformAdmin = { email: decoded.email, role: 'PLATFORM_ADMIN' };
    next();
  } catch {
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
    const isAllowed = modules.some(item => canAccessModule(req.user!, item));
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
