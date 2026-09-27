import { Request, Response, NextFunction } from 'express';
import Organization, { IOrganization } from '../models/Organization';
import Domain from '../models/Domain';

declare global {
  namespace Express {
    interface Request {
      organization?: IOrganization;
    }
  }
}

export const resolveTenant = async (req: Request, res: Response, next: NextFunction) => {
  const slug = req.header('x-organization-slug') || req.header('x-tenant-slug');
  const querySlug = req.query.tenant || req.query.org;
  const allowDevelopmentIdentifier = process.env.NODE_ENV !== 'production' || process.env.ALLOW_TENANT_HEADERS === 'true';

  try {
    let org: IOrganization | null = null;
    const host = (req.header('host') || '').split(':')[0].toLowerCase().replace(/\.$/, '');

    // Domain records are authoritative in production. Hosted subdomains remain supported.
    if (host) {
      const domainCandidates = host.startsWith('www.') ? [host, host.substring(4)] : [host];
      const configuredDomain = await Domain.findOne({ domain: { $in: domainCandidates }, status: 'ACTIVE', type: 'LANDING_PAGE' });
      if (configuredDomain) {
        org = await Organization.findOne({ _id: configuredDomain.organizationId, status: 'ACTIVE' });
      }
    }

    if (!org && allowDevelopmentIdentifier && slug) {
      org = await Organization.findOne({ slug: (slug as string).toLowerCase().trim() });
    } else if (!org && allowDevelopmentIdentifier && querySlug) {
      org = await Organization.findOne({ slug: (querySlug as string).toLowerCase().trim() });
    }

    if (!org) {
      const parts = host.split('.');
      const isHostedSubdomain = parts.length >= 3 && parts[parts.length - 2] === 'doybiz' && parts[parts.length - 1] === 'com';
      if (isHostedSubdomain && parts[0] !== 'www' && parts[0] !== 'api') {
        org = await Organization.findOne({ slug: parts[0], status: 'ACTIVE' });
      }
    }

    if (!org || org.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing public tenant domain.',
      });
    }

    req.organization = org;
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to resolve tenant context',
    });
  }
};
