const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const getJwtSecret = () => required('JWT_SECRET');

export const validateEnvironment = () => {
  required('JWT_SECRET');
  required('MONGODB_URI');
};
