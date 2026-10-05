import dotenv from 'dotenv';

dotenv.config();

/**
 * Returns a database URI dedicated to integration tests.
 * Prefer MONGODB_TEST_URI when explicitly configured. Otherwise derive a
 * separate database name from MONGODB_URI (for example, doybiz -> doybiz_test).
 */
export function getTestMongoUri(): string {
  const developmentUri = process.env.MONGODB_URI;
  const explicitTestUri = process.env.MONGODB_TEST_URI;

  if (explicitTestUri) {
    if (developmentUri && explicitTestUri === developmentUri) {
      throw new Error('MONGODB_TEST_URI must be different from MONGODB_URI. Refusing to run destructive integration tests against the development database.');
    }
    return explicitTestUri;
  }

  if (!developmentUri) {
    return 'mongodb://localhost:27017/doybiz_test';
  }

  let parsed: URL;
  try {
    parsed = new URL(developmentUri);
  } catch {
    throw new Error('Unable to derive a test database from MONGODB_URI. Set MONGODB_TEST_URI explicitly.');
  }

  const databaseName = parsed.pathname.replace(/^\//, '') || 'doybiz';
  if (databaseName.endsWith('_test')) {
    return developmentUri;
  }

  parsed.pathname = '/' + databaseName + '_test';
  const testUri = parsed.toString();

  if (testUri === developmentUri) {
    throw new Error('Test database URI resolved to the development database. Set MONGODB_TEST_URI explicitly.');
  }

  return testUri;
}