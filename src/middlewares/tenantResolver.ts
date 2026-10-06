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

const getConfiguredPublicHosts = () =>
  (process.env.DOYBIZ_PUBLIC_HOSTS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const getConfiguredPublicHostPatterns = () =>
  (process.env.DOYBIZ_PUBLIC_HOST_PATTERNS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const hostMatchesPattern = (host: string, pattern: string) => {
  if (!pattern.includes('*')) return host === pattern;

  const escapedPattern = pattern
    .replace(/[.+?^${}()|[\\]\\\\]/g, '\\const isApprovedPlatformHost = (host: string) =>
  getConfiguredPublicHosts().includes(host);')
    .replace(/\\*/g, '.*');

  return new RegExp('^' + escapedPattern + '

export const resolveTenant = async (req: Request, res: Response, next: NextFunction) => {
  const slug = req.header('x-organization-slug') || req.header('x-tenant-slug');
  const querySlug = req.query.tenant || req.query.org;
  const host = (req.header('host') || '').split(':')[0].toLowerCase().replace(/\.$/, '');
  const isProduction = process.env.NODE_ENV === 'production';
  const allowDevelopmentIdentifier = !isProduction || process.env.ALLOW_TENANT_HEADERS === 'true';
  const allowPlatformQueryTenant = !isProduction || isApprovedPlatformHost(host);

  try {
    let org: IOrganization | null = null;

    // Configured customer domains are authoritative and work in every environment.
    if (host) {
      const domainCandidates = host.startsWith('www.') ? [host, host.substring(4)] : [host];
      const configuredDomain = await Domain.findOne({
        domain: { $in: domainCandidates },
        status: 'ACTIVE',
        type: 'LANDING_PAGE',
      });
      if (configuredDomain) {
        org = await Organization.findOne({
          _id: configuredDomain.organizationId,
          status: 'ACTIVE',
        });
      }
    }

    // Local/development identifiers remain available for local testing.
    // In production, query-string tenant resolution is allowed only on explicitly
    // configured DoyBiz platform hosts, never on arbitrary customer domains.
    if (!org && allowDevelopmentIdentifier && slug) {
      org = await Organization.findOne({ slug: (slug as string).toLowerCase().trim() });
    } else if (!org && allowPlatformQueryTenant && querySlug) {
      org = await Organization.findOne({
        slug: (querySlug as string).toLowerCase().trim(),
        status: 'ACTIVE',
      });
    }

    if (!org) {
      const parts = host.split('.');
      const isHostedSubdomain =
        parts.length >= 3 &&
        parts[parts.length - 2] === 'doybiz' &&
        parts[parts.length - 1] === 'com';

      if (isHostedSubdomain && parts[0] !== 'www' && parts[0] !== 'api') {
        org = await Organization.findOne({
          slug: parts[0],
          status: 'ACTIVE',
        });
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
).test(host);
};

const isApprovedPlatformHost = (host: string) => {
  const exactHosts = getConfiguredPublicHosts();
  const patterns = getConfiguredPublicHostPatterns();
  return exactHosts.includes(host) || patterns.some((pattern) => hostMatchesPattern(host, pattern));
};

export const resolveTenant = async (req: Request, res: Response, next: NextFunction) => {
  const slug = req.header('x-organization-slug') || req.header('x-tenant-slug');
  const querySlug = req.query.tenant || req.query.org;
  const host = (req.header('host') || '').split(':')[0].toLowerCase().replace(/.$/, '');
  const isProduction = process.env.NODE_ENV === 'production';
  const allowDevelopmentIdentifier = !isProduction || process.env.ALLOW_TENANT_HEADERS === 'true';
  const allowPlatformQueryTenant = !isProduction || isApprovedPlatformHost(host);

  try {
    let org: IOrganization | null = null;

    // Configured customer domains are authoritative and work in every environment.
    if (host) {
      const domainCandidates = host.startsWith('www.') ? [host, host.substring(4)] : [host];
      const configuredDomain = await Domain.findOne({
        domain: { $in: domainCandidates },
        status: 'ACTIVE',
        type: 'LANDING_PAGE',
      });
      if (configuredDomain) {
        org = await Organization.findOne({
          _id: configuredDomain.organizationId,
          status: 'ACTIVE',
        });
      }
    }

    // Local/development identifiers remain available for local testing.
    // In production, query-string tenant resolution is allowed only on explicitly
    // configured DoyBiz platform hosts, never on arbitrary customer domains.
    if (!org && allowDevelopmentIdentifier && slug) {
      org = await Organization.findOne({ slug: (slug as string).toLowerCase().trim() });
    } else if (!org && allowPlatformQueryTenant && querySlug) {
      org = await Organization.findOne({
        slug: (querySlug as string).toLowerCase().trim(),
        status: 'ACTIVE',
      });
    }

    if (!org) {
      const parts = host.split('.');
      const isHostedSubdomain =
        parts.length >= 3 &&
        parts[parts.length - 2] === 'doybiz' &&
        parts[parts.length - 1] === 'com';

      if (isHostedSubdomain && parts[0] !== 'www' && parts[0] !== 'api') {
        org = await Organization.findOne({
          slug: parts[0],
          status: 'ACTIVE',
        });
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
