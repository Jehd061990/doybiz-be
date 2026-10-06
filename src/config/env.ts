const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const requiredInProduction = (name: string) => {
  if (process.env.NODE_ENV === 'production') required(name);
};

export const getJwtSecret = () => required('JWT_SECRET');

export const validateEnvironment = () => {
  required('JWT_SECRET');
  required('MONGODB_URI');

  // These integrations are required for a production deployment.
  // Development/test environments may intentionally omit them.
  requiredInProduction('CLOUDINARY_CLOUD_NAME');
  requiredInProduction('CLOUDINARY_API_KEY');
  requiredInProduction('CLOUDINARY_API_SECRET');
  requiredInProduction('XENDIT_SECRET_KEY');
  requiredInProduction('XENDIT_WEBHOOK_TOKEN');
};
