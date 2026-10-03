# Phase 5 Public Website and Tenant Resolution

## Status

PARTIALLY COMPLETE. Public site data, branch/service/staff discovery, availability, online reservations, custom-domain records, and domain-first tenant resolution are implemented and empirically tested. Business-hours configuration, email/SMS confirmations, domain ownership automation, and frontend UI remain outside this backend foundation.

## Public Endpoints

| Method | Endpoint | Purpose | Authentication |
| --- | --- | --- | --- |
| GET | `/api/public/site` | Public organization and primary-domain DTO | Active tenant domain |
| GET | `/api/public/branches` | Active branches | Active tenant domain |
| GET | `/api/public/services` | Active organization/branch services | Active tenant domain |
| GET | `/api/public/staff` | Active branch staff, optionally filtered by service | Active tenant domain |
| GET | `/api/public/availability` | Available appointment slots | Active tenant domain |
| POST | `/api/public/reservations` | Create a pending public reservation | Active tenant domain |

Public responses expose only booking-safe fields. Organization records, users, password hashes, subscriptions, internal settings, and customer enumeration are not exposed.

## Domain Management

Owner-only authenticated endpoints manage configured landing-page domains:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/domains` | List organization domains |
| POST | `/api/domains` | Create a pending unique domain |
| PUT | `/api/domains/:id` | Verify, activate, disable, or set primary domain |

Domains are unique across organizations. Only `ACTIVE` `LANDING_PAGE` domains resolve public tenants. Domain activation requires a verification timestamp. `www.example.com` and `example.com` resolve consistently after normalization.

## Tenant Resolution

Production public requests resolve in this order:

1. Exact configured active domain, with a `www` alias lookup.
2. DoyBiz-hosted subdomain such as `bellasalon.doybiz.com`, resolved through the organization slug.

In non-production, `x-organization-slug`, `x-tenant-slug`, or `tenant`/`org` query identifiers remain available for local testing. `x-organization-id` is not accepted by the public resolver. Set `NODE_ENV=production` to disable development identifiers.

Tenant identity never comes from the public reservation body, Origin, or Referer.

## Availability and Reservations

Availability validates the active tenant branch, service, staff, staff-service assignment, and date. The current data model has no business-hours configuration, so the documented fallback window is 09:00–18:00 with 30-minute start intervals. Service duration is honored and existing reservations with statuses other than `CANCELLED` and `NO_SHOW` block overlaps.

Public reservations reuse `validateAndPrepareReservation`, which performs the same organization, branch, service, staff, staff-service, date, and overlap checks as authenticated reservations. Public requests always create `WEBSITE` reservations with `PENDING` status; client status values cannot create completed or cancelled reservations. The response includes the reservation ID as `confirmationReference`.

## Customer Privacy

Public booking creates or finds a customer only inside the resolved organization using the submitted phone. There is no public customer list or lookup endpoint. Customer fields are not returned by a public search API.

## Testing

- `npm run build` passes.
- `npm run test:phase5` passes against the configured MongoDB instance.
- Coverage includes custom-domain resolution, public DTO privacy, active branch/service/staff filtering, cross-tenant ID rejection, availability slot generation, overlap blocking, public status tampering protection, and reservation creation.

## Limitations

Business hours, holidays, staff schedules, domain DNS/ownership verification, rate limiting/CAPTCHA, email/SMS confirmation, and frontend website rendering are future work. Phase 1–4 APIs and models were preserved.

## Website CMS Configuration (Phase 7 Foundation)

The authenticated Website CMS is implemented as a separate tenant-scoped configuration layer:

- `WebsiteConfig` stores one document per organization.
- `draft` contains the editable configuration.
- `published` contains the public configuration.
- `GET /api/website` returns both versions for the authenticated organization.
- `PUT /api/website` normalizes and saves the draft only.
- `POST /api/website/publish` copies the draft to published and records `publishedAt`.
- `GET /api/public/site` exposes only the published website configuration.

Current configuration covers branding colors, hero content/image URL, Services/Branches/Contact section visibility and labels, and footer text. Website configuration never replaces operational DoyBiz data such as services, branches, staff, availability, or reservations.

The authenticated Website routes require `authenticateUser` plus `authorizeModule('WEBSITE')`. Tenant isolation is derived from the authenticated user's organization; clients do not submit an organization ID to choose the target tenant.

### CMS Testing

`src/testPhase7.ts` empirically verifies default creation, draft-only updates, publish promotion, and public-site consumption of the published configuration. It uses a test MongoDB database and must not be treated as a unit test.

### Future CMS Scope

Media uploads, media library, SEO metadata, section ordering, additional public pages, visual page editing, template/theme management, and domain ownership automation are not part of the current foundation.
