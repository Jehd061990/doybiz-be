import assert from 'assert';
import { openApiSpec } from './docs/openapi';

const requiredPaths = [
  '/auth/register',
  '/auth/login',
  '/users',
  '/branches',
  '/customers',
  '/staff',
  '/services',
  '/reservations',
  '/public/site',
  '/public/reservations',
  '/sales',
  '/reports/sales/summary',
  '/dashboard/summary',
  '/domains',
  '/subscription',
  '/billing',
  '/billing/xendit/webhook',
];

assert.equal(openApiSpec.openapi, '3.0.3');
assert.ok(openApiSpec.info.title);
assert.ok(openApiSpec.components.securitySchemes.bearerAuth);

for (const path of requiredPaths) {
  const documentedPath = openApiSpec.paths[path as keyof typeof openApiSpec.paths];
  assert.ok(documentedPath, `Missing OpenAPI path: ${path}`);
}

console.log(`Swagger/OpenAPI smoke test passed: ${requiredPaths.length} required route groups documented.`);
