import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Organization from '../models/Organization';
import User, { IUser } from '../models/User';

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
  });

  const token = jwt.sign(
    { userId: user._id, organizationId: org._id, role: user.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '7d' }
  );
  
  return { org, user, token };
};

export const login = async (data: any) => {
  const { email, password, organizationId } = data;
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const query: any = { email: email.toLowerCase().trim() };
  if (organizationId) {
    query.organizationId = organizationId;
  }

  const user = await User.findOne(query);
  if (!user || user.status !== 'ACTIVE') {
    throw new Error('Invalid credentials or inactive account');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign(
    { userId: user._id, organizationId: user.organizationId, role: user.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '7d' }
  );

  return { user, token };
};

export const getOrganizationBySlug = async (slug: string) => {
  return await Organization.findOne({ slug: slug.toLowerCase().trim(), status: 'ACTIVE' });
};
