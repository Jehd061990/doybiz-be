import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Organization from '../models/Organization';
import User, { VALID_MODULES } from '../models/User';

const jwtSecret = () => process.env.JWT_SECRET || 'secret';

export interface PlatformAdminIdentity {
  _id: 'platform-admin';
  name: string;
  email: string;
  role: 'PLATFORM_ADMIN';
  scope: 'PLATFORM_ADMIN';
  status: 'ACTIVE';
}

const getPlatformAdminConfig = () => ({
  enabled: process.env.SUPER_ADMIN_ENABLED !== 'false',
  email: (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim(),
  passwordHash: process.env.SUPER_ADMIN_PASSWORD_HASH || '',
});

export const loginPlatformAdmin = async (email: string, password: string): Promise<{ user: PlatformAdminIdentity; token: string } | null> => {
  const config = getPlatformAdminConfig();
  if (!config.enabled || !config.email || !config.passwordHash || email !== config.email) return null;
  const isMatch = await bcrypt.compare(password, config.passwordHash);
  if (!isMatch) return null;

  const user: PlatformAdminIdentity = {
    _id: 'platform-admin',
    name: 'Super Admin',
    email: config.email,
    role: 'PLATFORM_ADMIN',
    scope: 'PLATFORM_ADMIN',
    status: 'ACTIVE',
  };
  const token = jwt.sign(
    { scope: 'PLATFORM_ADMIN', role: 'PLATFORM_ADMIN', email: config.email },
    jwtSecret(),
    { expiresIn: '7d' },
  );
  return { user, token };
};

export const registerOrganization = async (data: any) => {
  const { orgName, email, phone, address, userName, password, slug } = data;
  
  const org = await Organization.create({
    name: orgName,
    slug: slug ? slug.toLowerCase().trim() : undefined,
    email,
    phone,
    address,
  });

  const passwordHash = await bcrypt.hash(password, 10);
  
  const user = await User.create({
    organizationId: org._id,
    name: userName,
    email,
    passwordHash,
    role: 'OWNER',
    branchAccess: 'ALL',
    permissionPreset: 'OWNER',
    modulePermissions: [...VALID_MODULES],
  });

  const token = jwt.sign(
    { userId: user._id, organizationId: org._id, role: user.role, scope: 'ORGANIZATION' },
    jwtSecret(),
    { expiresIn: '7d' }
  );
  
  return { org, user, token };
};

export const login = async (data: any) => {
  const { email, password, organizationId } = data;
  const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
  if (!normalizedEmail || !password) {
    throw new Error('Email and password are required');
  }

  const platformAdmin = await loginPlatformAdmin(normalizedEmail, password);
  if (platformAdmin) return platformAdmin;

  const query: any = { email: normalizedEmail };
  let user;
  if (organizationId) {
    query.organizationId = organizationId;
    user = await User.findOne(query);
  } else {
    const matchingUsers = await User.find(query).limit(2);
    if (matchingUsers.length > 1) {
      throw new Error('organizationId is required when email is associated with multiple organizations');
    }
    user = matchingUsers[0] || null;
  }

  if (!user || user.status !== 'ACTIVE') {
    throw new Error('Invalid credentials or inactive account');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign(
    { userId: user._id, organizationId: user.organizationId, role: user.role, scope: 'ORGANIZATION' },
    jwtSecret(),
    { expiresIn: '7d' }
  );

  return { user, token };
};

export const getOrganizationBySlug = async (slug: string) => {
  return await Organization.findOne({ slug: slug.toLowerCase().trim(), status: 'ACTIVE' });
};
