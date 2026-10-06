import axios from 'axios';
import crypto from 'crypto';

const MAX_IMAGE_BYTES = 300 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const CLOUDINARY_ENVIRONMENTS = new Set(['dev', 'staging', 'qa', 'prod']);

const getCloudinaryEnvironment = () => {
  const value = (process.env.DOYBIZ_ENV || 'dev').trim().toLowerCase();
  if (!CLOUDINARY_ENVIRONMENTS.has(value)) {
    throw new Error(
      `Cloudinary is not configured: DOYBIZ_ENV must be one of dev, staging, qa, or prod (received "${value}")`,
    );
  }
  return value;
};

const getCloudinaryRoot = () => `doybiz/${getCloudinaryEnvironment()}`;

const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Cloudinary is not configured: missing ${name}`);
  return value;
};

const sign = (params: Record<string, string>) => {
  const serialized = Object.entries(params).filter(([, value]) => value !== '').sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&');
  return crypto.createHash('sha1').update(`${serialized}${requiredEnv('CLOUDINARY_API_SECRET')}`).digest('hex');
};

export const uploadServiceImage = async (dataUri: string, organizationId: string, serviceId: string) => {
  if (typeof dataUri !== 'string' || !dataUri.startsWith('data:image/')) throw new Error('Service image must be a valid image data URI');
  const match = dataUri.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !ALLOWED_MIME_TYPES.has(match[1])) throw new Error('Only JPEG, PNG, and WebP service images are supported');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error('Processed service image must be 300 KB or smaller');

  const cloudName = requiredEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = requiredEnv('CLOUDINARY_API_KEY');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = `${getCloudinaryRoot()}/organizations/${organizationId}/services`;
  const publicId = `service-${serviceId}`;
  const params = {
    folder, public_id: publicId, timestamp, overwrite: 'true', invalidate: 'true',
    format: 'webp', transformation: 'c_limit,w_800,h_800,q_auto',
  };
  const signature = sign(params);
  const body = new URLSearchParams({ file: dataUri, ...params, api_key: apiKey, signature });

  const response = await axios.post(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000,
  });
  return {
    secureUrl: String(response.data.secure_url), publicId: String(response.data.public_id),
    width: Number(response.data.width || 0), height: Number(response.data.height || 0),
    bytes: Number(response.data.bytes || 0), format: String(response.data.format || 'webp'),
  };
};

export const deleteServiceImage = async (publicId: string) => {
  if (!publicId) return;
  const cloudName = requiredEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = requiredEnv('CLOUDINARY_API_KEY');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = { public_id: publicId, timestamp };
  const signature = sign(params);
  await axios.post(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, new URLSearchParams({ ...params, api_key: apiKey, signature }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000,
  });
};


export const uploadMediaImage = async (
  buffer: Buffer,
  mimeType: string,
  organizationId: string,
  publicId: string,
) => {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new Error('Only JPEG, PNG, and WebP images are supported');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller');

  const cloudName = requiredEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = requiredEnv('CLOUDINARY_API_KEY');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = `${getCloudinaryRoot()}/organizations/${organizationId}/media`;
  const params = {
    folder,
    public_id: publicId,
    timestamp,
  };
  const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
  const signature = sign(params);
  const body = new URLSearchParams({
    file: dataUri,
    ...params,
    api_key: apiKey,
    signature,
  });

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
    body.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000,
    },
  );

  return {
    publicId: String(response.data.public_id),
    secureUrl: String(response.data.secure_url),
  };
};

export const deleteMediaImage = async (publicId: string) => {
  if (!publicId) return;
  const cloudName = requiredEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = requiredEnv('CLOUDINARY_API_KEY');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = {
    public_id: publicId,
    timestamp,
    invalidate: 'true',
  };
  const signature = sign(params);
  const body = new URLSearchParams({
    ...params,
    api_key: apiKey,
    signature,
  });

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`,
    body.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000,
    },
  );

  const result = String(response.data?.result || '');
  if (result && result !== 'ok' && result !== 'not found') {
    throw new Error(`Cloudinary image deletion failed: ${result}`);
  }
};
