# Backend Verification and API Documentation

## Verification scripts

- `npm test` runs the safe Swagger/OpenAPI smoke test.
- `npm run typecheck` runs TypeScript type checking without emitting files.
- `npm run build` compiles the backend.
- `npm run test:integration` runs the existing Phase 2–6 empirical integration tests.

The Phase 2–6 integration tests connect to MongoDB and clear test collections. Run them only against a dedicated test database.

## Swagger / OpenAPI

When the backend is running:

- Swagger UI: `/api-docs`
- OpenAPI JSON: `/api-docs/openapi.json`

The documentation reflects the existing Express route surface and JWT bearer authentication contract. Swagger UI is loaded from the official Swagger UI distribution CDN; no new runtime npm dependency is required. Swagger UI supports interactive API exploration for OpenAPI definitions. 

Authentication-protected endpoints use the `bearerAuth` security scheme. Public tenant endpoints and the Xendit webhook are documented without bearer authentication.

## Current route groups

- Auth
- Users
- Branches
- Customers
- Staff
- Services
- Reservations
- Public
- Sales
- Reports
- Dashboard
- Domains
- Subscription
- Billing
