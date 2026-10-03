# Phase 7 — Website CMS Backend Foundation

## Status

IMPLEMENTED FOUNDATION.

## Purpose

Provide a tenant-scoped website configuration that the DoyBiz frontend can edit through a CMS while keeping public booking and operational data on the existing backend contracts.

## Model

`WebsiteConfig` is unique per organization and contains:

- `draft` — editable configuration.
- `published` — configuration currently exposed to the public site.
- `publishedAt` — last publication timestamp.

The configuration currently includes branding, hero content, Services/Branches/Contact section settings, and footer text.

## Authenticated API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/website` | Read the authenticated organization's draft and published config |
| PUT | `/api/website` | Normalize and save the draft |
| POST | `/api/website/publish` | Promote the draft to published |

All routes require authentication and the `WEBSITE` module permission.

## Public API

The existing `GET /api/public/site` response includes the published website configuration. Public consumers never receive the draft.

## Tenant Isolation

The authenticated user determines `organizationId`. The request body cannot select another organization. Public configuration is retrieved by the already-resolved public tenant organization.

## Normalization

The backend validates color values against six-digit hex colors and trims/limits editable text. Invalid values fall back to the current configuration instead of being persisted as malformed values.

## Empirical Test

Run:

```powershell
npm run test:phase7
```

The test verifies:

1. default WebsiteConfig creation;
2. draft updates do not change published content;
3. publish promotes the draft;
4. public-site reads the newly published configuration.

Also run `npm run build` before considering the phase complete.

## Future Scope

Media storage/upload, SEO metadata, page/section ordering, multiple public pages, visual editing, theme/template systems, and domain DNS/ownership automation are future CMS phases.
