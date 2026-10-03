# Phase 8 — Website Media Library

## Purpose

Provide organization-scoped image uploads for the Website CMS so administrators can select a Hero image without manually hosting and pasting an external URL.

## Current implementation

- Protected by the WEBSITE module permission.
- Supports JPG, PNG, and WebP.
- Maximum image size: 5 MB.
- Files are stored under MEDIA_UPLOAD_DIR when configured, otherwise ./uploads/media.
- Each organization has its own storage directory.
- MongoDB stores media metadata in MediaAsset.
- Media URLs are exposed through the frontend same-origin /api/media/... proxy.
- Hero image selection updates the CMS draft; publishing remains a separate action.
- Images currently used by the draft or published Hero cannot be deleted.

## API

Authenticated:

- GET /api/website/media
- POST /api/website/media with multipart field file
- DELETE /api/website/media/:id

Public/static storage:

- Backend files are served internally from /uploads/media/....
- The frontend exposes them through GET /api/media/....

## Storage note

The current storage provider is local filesystem storage. This is appropriate for local development and a single persistent server. For horizontally scaled production deployments, the storage service should later be replaced or extended with an object-storage provider such as S3-compatible storage.

## CMS behavior

The Website CMS Hero section now includes a Media Library:

1. Upload image.
2. Preview image.
3. Use image for Hero.
4. Save draft.
5. Publish when ready.

Existing external Hero image URLs remain supported for backward compatibility.
