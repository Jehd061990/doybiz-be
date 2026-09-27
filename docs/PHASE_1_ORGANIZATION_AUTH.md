# Phase 1 - Organization, Branch, User, and Authentication

## 1. Objective

Phase 1 establishes the initial organization tenant, the first owner account, branch persistence, and JWT-based authentication/role authorization used by later phases.

The development plan describes Phase 1 as Organization + Branch + User + Authentication. The implementation provides those core models and flows, but it does not provide a dedicated user-management route or a `/api/users/me` route.

## 2. Implemented Features

- Organization registration together with the first `OWNER` user.
- Organization and user persistence in MongoDB through Mongoose.
- Login using organization-scoped email lookup and bcrypt password comparison.
- JWT creation during registration and login.
- Bearer-token authentication middleware.
- Role authorization for `OWNER`, `MANAGER`, and `CASHIER`.
- Branch creation by owners.
- Organization-scoped branch listing for authenticated users.
- Organization status and user status checks during authentication.

Not confirmed from the current implementation: a standalone user-management API, profile endpoint, password reset flow, refresh tokens, invitation flow, or a dedicated Phase 1 test file.

## 3. Architecture / Components

### Models

- `Organization`: business tenant identity and contact information.
- `User`: organization member, role, branch access, password hash, and active status.
- `Branch`: organization branch and contact information.

### Services

- `authService.ts`: organization registration, password hashing, login, JWT creation, and active-organization lookup by slug.
- `branchService.ts`: branch creation and organization-scoped branch listing.

### Controllers and Routes

- `authController.ts` handles registration and login responses.
- `branchController.ts` handles branch listing and creation responses.
- `authRoutes.ts` mounts `/api/auth/register` and `/api/auth/login`.
- `branchRoutes.ts` authenticates all requests and applies role middleware.

### Middleware

- `authenticateUser` reads `Authorization: Bearer <token>` (or the raw authorization value), verifies the JWT, loads the user by the token's `userId`, and rejects missing, invalid, inactive, or missing users.
- `authorizeRole(roles)` rejects requests whose authenticated role is not in the supplied list.

### Database and Application

- `src/index.ts` loads environment variables, creates the Express app, registers routes, and connects to MongoDB using `MONGODB_URI` or the repository's local fallback.
- `src/config/` and `src/validators/` are empty in the inspected repository.
- The global Express error handler returns HTTP 500 JSON for uncaught errors.

## 4. API Endpoints

### `POST /api/auth/register`

- Authentication: none.
- Authorization: none.
- Body fields used: `orgName`, `email`, `phone`, `address`, `userName`, `password`, optional `slug`.
- Behavior: creates an Organization, hashes the password with bcrypt, creates an `OWNER` with `branchAccess: 'ALL'`, and signs a seven-day JWT.
- Success: HTTP 201 with `success`, organization, user, and token values returned from the auth service.
- Errors: HTTP 400 with `success: false` and an error message.
- Validation: the controller itself does not perform detailed field validation; Mongoose required/unique constraints and service behavior apply.

### `POST /api/auth/login`

- Authentication: none.
- Authorization: none.
- Body fields used: `email`, `password`, optional `organizationId`.
- Behavior: finds the user by normalized email, optionally organization ID, requires an active user, compares the password with bcrypt, and signs a seven-day JWT.
- Success: HTTP 200 with `success`, user, and token.
- Errors: HTTP 400 for missing credentials, invalid credentials, or inactive accounts.

### `GET /api/branches`

- Authentication: required.
- Roles: `OWNER`, `MANAGER`, `CASHIER`.
- Query/body/params: none.
- Behavior: returns branches whose `organizationId` equals the authenticated user's organization ID.
- Success: returns the branch array directly, without the standard `success` wrapper used by most later controllers.
- Errors: HTTP 500 with `Failed to fetch branches`.

### `POST /api/branches`

- Authentication: required.
- Role: `OWNER` only.
- Body: arbitrary branch fields are spread into the create payload; the service adds the authenticated organization ID.
- Success: HTTP 201 with the created branch document.
- Errors: HTTP 400 with an error message.
- Persistence validation: Branch schema required fields are `name`, `address`, and `contactNumber`; status defaults to `ACTIVE`.

The development plan lists `GET /api/users/me` as an existing route. No user route, user controller, or `/api/users` registration was found in `src/`.

## 5. Data Models

### Organization

Fields: `name`, optional unique sparse `slug`, unique `email`, `phone`, `address`, `status` (`ACTIVE` or `INACTIVE`), timestamps.

### User

Fields: `organizationId`, `name`, `email`, `passwordHash`, `role` (`OWNER`, `MANAGER`, `CASHIER`), `branchAccess` (`'ALL'` or an array of branch ID values), `status` (`ACTIVE` or `INACTIVE`), timestamps.

Indexes: unique compound `{ organizationId, email }`; organization ID index.

### Branch

Fields: `organizationId`, `name`, `address`, `contactNumber`, `status` (`ACTIVE` or `INACTIVE`), timestamps.

Indexes: organization ID index. No unique branch-name constraint is defined.

## 6. Business Rules

- Registration creates exactly one initial owner for the new organization.
- The initial owner has access to all branches through `branchAccess: 'ALL'`.
- Login requires an active user; inactive users cannot authenticate.
- An authenticated user's organization is taken from the persisted User document loaded from the JWT user ID.
- Owners can create branches. Managers and cashiers can list branches.
- The implementation does not automatically create a branch during organization registration.
- The implementation does not expose subscription enforcement or billing checks at this phase.

The plan states that at least one active owner must always remain and that the last owner cannot be deleted, deactivated, or demoted. No user-management mutation endpoints or corresponding owner-protection implementation were found, so this rule is not confirmed as enforced by the current code.

## 7. Security / Authorization

- Passwords are hashed with bcrypt before persistence; plaintext passwords are not stored by the service.
- JWTs are signed with `JWT_SECRET` or the code's fallback when the environment variable is absent. The secret value is not documented here.
- Authentication reloads the user by JWT `userId` and checks `status === 'ACTIVE'`.
- Role checks are explicit per route.
- Branch listing and branch creation use the authenticated user's organization ID rather than a client-supplied organization ID.
- The login query accepts an optional organization ID from the login body to disambiguate users; it is not used to grant access after authentication.
- There is no separate tenant-resolver middleware on authenticated Phase 1 routes; tenant identity is derived from the authenticated User document.

Potential exposure: the registration and login controllers return the User document supplied by the auth service, and the User schema has no serialization transform. The current response may therefore include the persisted `passwordHash` field. This documentation does not reproduce its value; the behavior is recorded as an existing security limitation.

## 8. Database / Persistence

Mongoose models use `timestamps: true`. Organization and User documents are created separately during registration; no MongoDB transaction is used for that two-document workflow. Branches are stored with an organization reference and queried by that reference.

Relevant indexes are the organization/email uniqueness index on User and organization indexes on Organization and Branch. No migrations or seed scripts were found in the inspected source tree.

## 9. Testing

- No `src/testPhase1.ts` or dedicated Phase 1 test file was found.
- `src/testPhase2.ts` exercises Phase 1 registration as its first scenario and then creates a branch for the registered organization.
- Existing command: `npx ts-node src/testPhase2.ts`. There is no `test:phase2` npm script in `package.json`.
- The inspected Phase 2 test connected to MongoDB, registered an organization and owner, and passed the Phase 1 setup portion.
- `npm run build` was run after documentation creation and passed.

## 10. Files Created / Modified

### Phase 1 implementation files

- `src/models/Organization.ts`
- `src/models/User.ts`
- `src/models/Branch.ts`
- `src/services/authService.ts`
- `src/services/branchService.ts`
- `src/controllers/authController.ts`
- `src/controllers/branchController.ts`
- `src/routes/authRoutes.ts`
- `src/routes/branchRoutes.ts`
- `src/middlewares/auth.ts`
- `src/index.ts`
- `package.json`
- `tsconfig.json`

### Phase 1 documentation

- `docs/PHASE_1_ORGANIZATION_AUTH.md` (this file)

The implementation files were inspected but not modified for this documentation task.

## 11. Dependencies / Integration

Phase 1 supplies `req.user`, organization IDs, roles, and branch access data used by Phase 2 customer, staff, service, and reservation routes. Later phases reuse the same `authenticateUser`, `authorizeRole`, Mongoose organization references, and branch-access convention.

## 12. Known Limitations

- No dedicated Phase 1 test file or npm test script.
- No user-management endpoints were found.
- No `/api/users/me` endpoint was found despite being listed in the development plan.
- Last-active-owner protection is not confirmed in the current implementation.
- Registration is not transactional across Organization and User creation.
- Branch creation has minimal service-level validation and does not explicitly validate branch status or owner access beyond route role authorization.
- The auth response may serialize `passwordHash` because no User transform is defined.
- No refresh-token, password-reset, invitation, email-verification, or subscription-enforcement workflow is implemented here.

## 13. Phase Status

PARTIALLY COMPLETE. The organization, branch, user, JWT authentication, and role middleware foundation is implemented and used by later phases. The planned user profile/management surface and confirmed last-owner protection are absent or unconfirmed.
