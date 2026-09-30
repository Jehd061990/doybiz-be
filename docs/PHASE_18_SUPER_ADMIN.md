# Phase 18 — Super Admin Foundation

## Purpose
Adds a platform-level bootstrap Super Admin without adding `SUPER_ADMIN` to the tenant `User.role` registry.

## Authentication
- Same `/api/auth/login` endpoint is used by tenant users and the bootstrap Super Admin.
- Super Admin credentials are supplied through environment variables.
- Password is stored as a bcrypt hash, never plaintext.
- Platform JWTs use `scope=PLATFORM_ADMIN`.
- Tenant JWTs use `scope=ORGANIZATION`.
- Tenant authentication middleware rejects platform tokens.
- Platform routes reject tenant tokens.

## Environment
Set these backend variables:

    SUPER_ADMIN_ENABLED=true
    SUPER_ADMIN_EMAIL=admin@doybiz.com
    SUPER_ADMIN_PASSWORD_HASH=<bcrypt hash>

Generate the bcrypt hash locally using the project's installed `bcryptjs` dependency. Do not commit the real `.env` file or plaintext password.

## Platform provisioning endpoints
All require a valid platform-admin JWT:
- `GET /api/platform/organizations`
- `POST /api/platform/organizations`
- `GET /api/platform/organizations/:organizationId/branches`
- `POST /api/platform/organizations/:organizationId/branches`
- `GET /api/platform/organizations/:organizationId/users`
- `POST /api/platform/organizations/:organizationId/users`

User provisioning reuses the existing tenant user service, including:
- OWNER / MANAGER / CASHIER roles
- permission presets
- module permissions
- branch access validation
- active/inactive status
- password hashing

## Frontend
- Same login screen is used.
- Platform admin login redirects to `/app/super-admin`.
- Tenant login continues to `/app`.
- Super Admin workspace supports organization creation, branch creation, and tenant user creation/listing.
- Tenant role and module permission rules remain unchanged.

## Verification
Run backend:

    npm run typecheck

Run frontend:

    npm run typecheck
    npm test -- --runInBand

Swagger/OpenAPI is updated in `src/docs/openapi.ts` whenever the platform endpoints are added.
