# Phase 2 - Customer, Staff, Service, and Reservation

## 1. Objective

Phase 2 adds the organization-scoped operational data needed to schedule service appointments: customers, branches' staff, services, staff-service assignments, reservations, and public reservation creation.

The implementation also provides branch-aware authorization, service/staff compatibility checks, pagination and filtering for management lists, and server-side reservation conflict detection.

## 2. Implemented Features

- Customer create, list/search, retrieve, update, and soft deactivation.
- Staff create, list/search, retrieve, update, and soft deactivation.
- Service create, list/search, retrieve, update, and soft deactivation.
- Branch-specific and organization-wide service visibility for authenticated users.
- Staff-service assignment and unassignment.
- Reservation create, list/filter, retrieve, update, and cancellation through soft status change.
- Customer, branch, service, staff, and staff-service validation during reservation creation/update.
- Staff schedule overlap prevention using service duration and reservation status.
- Public reservation customer find/create by phone inside the resolved organization.
- Public reservation creation using the existing tenant resolver and public route.
- Pagination metadata for customer, staff, service, and reservation lists.

## 3. Architecture / Components

### Models

- `Customer`: organization-owned client record.
- `Staff`: active/inactive staff member assigned to one branch.
- `Service`: organization-owned service that may be branch-specific or organization-wide.
- `StaffService`: active/inactive staff-to-service assignment with organization and optional branch reference.
- `StaffServiceMapping`: an additional mapping model present in the repository; the Phase 2 services and routes use `StaffService`.
- `Reservation`: appointment linking an organization, branch, customer, service, staff member, date, time, duration, status, source, and optional creator.
- `Branch`: Phase 1 branch referenced by staff, reservations, and branch-specific services.

### Services

- `customerService.ts`: customer CRUD-like operations, organization scoping, search, and pagination.
- `staffService.ts`: staff CRUD-like operations, branch access checks, list filtering, and StaffService assignment management.
- `serviceService.ts`: service CRUD-like operations, branch access checks, branch-specific/organization-wide filtering, and pagination.
- `reservationService.ts`: shared reservation validation, reservation creation, public reservation creation, list filtering, update, cancellation, and overlap detection.

### Controllers and Routes

- `customerController.ts` / `customerRoutes.ts`
- `staffController.ts` / `staffRoutes.ts`
- `serviceController.ts` / `serviceRoutes.ts`
- `reservationController.ts` / `reservationRoutes.ts`
- `publicController.ts` / `publicRoutes.ts` for the current public site and reservation surface.
- `publicReservationController.ts` remains in the repository but the current `publicRoutes.ts` uses `publicController.createReservation`.

### Middleware and Utilities

- Authenticated Phase 2 routes use `authenticateUser` and `authorizeRole` from Phase 1.
- `canAccessBranch` and `getAllowedBranchIds` enforce the existing owner/all-branches or assigned-branch model.
- `timeHelper.ts` parses 24-hour and 12-hour input, normalizes times to `HH:mm`, validates dates, formats minute offsets, and detects interval overlap.
- Public routes use `resolveTenant` from the current Phase 5 implementation. In production, configured active domains resolve the organization; development identifiers may be used according to that middleware's documented behavior.

## 4. API Endpoints

All authenticated routes below require a valid Bearer JWT. Role requirements are applied by route middleware.

### Customers

| Method | Route | Roles | Request and behavior |
| --- | --- | --- | --- |
| POST | `/api/customers` | OWNER, MANAGER | Body requires `firstName`, `lastName`, and `phone`; creates an active organization-scoped customer. |
| GET | `/api/customers` | OWNER, MANAGER, CASHIER | Query: `search`, `phone`, `status`, `page`, `limit`; returns `data` and pagination metadata. |
| GET | `/api/customers/:id` | OWNER, MANAGER, CASHIER | Organization-scoped customer lookup; validates ObjectId format. |
| PUT | `/api/customers/:id` | OWNER, MANAGER | Applies a validated Mongoose update to the organization-scoped customer. |
| DELETE | `/api/customers/:id` | OWNER, MANAGER | Soft deactivates the customer by setting `status` to `INACTIVE`. |

### Staff

| Method | Route | Roles | Request and behavior |
| --- | --- | --- | --- |
| POST | `/api/staff` | OWNER, MANAGER | Body requires `branchId`, `firstName`, `lastName`, `phone`, and `position`; validates organization branch and access. |
| GET | `/api/staff` | OWNER, MANAGER, CASHIER | Query: `branchId`, `search`, `position`, `status`, `page`, `limit`; branch-limits non-owners automatically. |
| GET | `/api/staff/:id` | OWNER, MANAGER, CASHIER | Returns an organization-scoped staff member if the caller can access its branch. |
| PUT | `/api/staff/:id` | OWNER, MANAGER | Updates staff fields; branch changes validate target organization and access. |
| DELETE | `/api/staff/:id` | OWNER, MANAGER | Soft deactivates the staff member. |
| POST | `/api/staff/:staffId/services/:serviceId` | OWNER, MANAGER | Creates or reactivates a StaffService assignment after validating staff, service, and branch compatibility. |
| DELETE | `/api/staff/:staffId/services/:serviceId` | OWNER, MANAGER | Marks the assignment `INACTIVE`. |
| GET | `/api/staff/:staffId/services` | OWNER, MANAGER, CASHIER | Lists services assigned to an accessible staff member. |

### Services

| Method | Route | Roles | Request and behavior |
| --- | --- | --- | --- |
| POST | `/api/services` | OWNER, MANAGER | Body requires `name`, `price`, and `durationMinutes`; optional `branchId`; validates non-negative price and positive duration. |
| GET | `/api/services` | OWNER, MANAGER, CASHIER | Query: `branchId`, `search`, `status`, `page`, `limit`; returns branch services plus organization-wide services where applicable. |
| GET | `/api/services/:id` | OWNER, MANAGER, CASHIER | Organization-scoped service lookup with branch access validation for branch-specific services. |
| PUT | `/api/services/:id` | OWNER, MANAGER | Updates service fields; price must be non-negative and duration must be positive. |
| DELETE | `/api/services/:id` | OWNER, MANAGER | Soft deactivates the service. |

### Reservations

| Method | Route | Roles | Request and behavior |
| --- | --- | --- | --- |
| POST | `/api/reservations` | OWNER, MANAGER, CASHIER | Body requires branch, customer, service, staff, date, and time IDs/values; validates all relationships and prevents overlap. |
| GET | `/api/reservations` | OWNER, MANAGER, CASHIER | Query: `branchId`, `date`, `status`, `staffId`, `customerId`, `page`, `limit`; returns paginated reservations. |
| GET | `/api/reservations/:id` | OWNER, MANAGER, CASHIER | Organization and branch-access scoped reservation lookup. |
| PUT | `/api/reservations/:id` | OWNER, MANAGER, CASHIER | Revalidates the merged reservation data, including branch, staff-service compatibility, date/time, and overlap. |
| DELETE | `/api/reservations/:id` | OWNER, MANAGER | Does not delete; changes reservation status to `CANCELLED`. |

### Public Reservation

| Method | Route | Authentication | Request and behavior |
| --- | --- | --- | --- |
| POST | `/api/public/reservations` | No JWT; active tenant resolution required | Body contains customer `firstName`, `lastName`, `phone`, optional `email`/`notes`, and reservation fields. The organization is resolved by middleware, not accepted from the body. Current public flow forces `source: WEBSITE` and `status: PENDING`, finds/creates the customer by organization-scoped phone, then applies shared reservation validation. |

The current Phase 5 public routes also expose `/api/public/site`, `/api/public/branches`, `/api/public/services`, `/api/public/staff`, and `/api/public/availability`; those public website endpoints are documented in `PHASE_5_PUBLIC_WEBSITE.md`, not introduced as separate Phase 2 behavior.

## 5. Data Models

### Customer

`organizationId`, `firstName`, `lastName`, `phone`, optional `email`, `address`, `notes`, `status` (`ACTIVE`/`INACTIVE`), timestamps.

Indexes: organization/phone and organization/createdAt. Phone is indexed but not globally unique.

### Staff

`organizationId`, required `branchId`, name fields, `phone`, optional `email`, `position`, `status`, timestamps.

Indexes: organization/branch/status and organization/phone.

### Service

`organizationId`, optional `branchId`, `name`, optional `description`, non-negative `price`, positive `durationMinutes`, `status`, timestamps.

Indexes: organization/branch/status and organization/name. A null/missing branch ID represents an organization-wide service in service-list logic.

### StaffService

`organizationId`, `staffId`, `serviceId`, optional `branchId`, `status`, timestamps.

Indexes: unique organization/staff/service assignment, organization/staff, and organization/service.

### Reservation

`organizationId`, `branchId`, `customerId`, `serviceId`, `staffId`, `appointmentDate` as `YYYY-MM-DD`, normalized `appointmentTime` as `HH:mm`, `durationMinutes`, status (`PENDING`, `CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`, `NO_SHOW`), optional notes, source (`ADMIN`, `STAFF`, `WEBSITE`), optional `createdBy`, timestamps.

Indexes: organization/branch/date/staff/status, staff/date/status, organization/customer, and organization/date.

## 6. Business Rules

- Customers, staff, services, assignments, and reservations are organization-scoped.
- Staff must belong to the selected branch.
- A branch-specific service must belong to the selected branch; organization-wide services can be used at branches according to service logic.
- A staff member must have an active StaffService assignment for the selected service.
- Reservation duration comes from the selected Service, not from an arbitrary client duration.
- Dates must use `YYYY-MM-DD`; times are normalized to `HH:mm`.
- Existing reservations block overlaps for the same staff member and date unless their status is `CANCELLED` or `NO_SHOW`.
- Back-to-back appointments are allowed when one interval ends exactly as the next begins.
- Authenticated delete operations for customers, staff, services, and reservations are soft state changes (`INACTIVE` or `CANCELLED`), not physical deletes.
- Public reservations create or find a customer by phone within the resolved organization and cannot choose a different organization through the request body.
- Reservation creation does not create a Sale. Sale conversion is a later Phase 3 operation and requires a completed reservation.

## 7. Security / Authorization

- Authenticated routes use JWT authentication and explicit role middleware.
- OWNER has unrestricted branch access through the existing branch-access utility.
- A user with `branchAccess: 'ALL'` can access all branches; other users are limited to listed branch IDs.
- Staff, service, and reservation reads and writes validate branch access where a branch is involved.
- Service and reservation queries include the authenticated organization ID; ID lookups are not global `findById` operations.
- Public tenant identity is resolved by the current tenant middleware. Public reservation organization identity is derived from `req.organization`, not `organizationId` in the request body.
- Public customer lookup is restricted to matching phone and the resolved organization; there is no public customer enumeration endpoint.

Known implementation detail: `getReservations` validates branch access for an explicit `branchId` and restricts non-owners when no branch is supplied, but its optional `staffId` and `customerId` filters are only ObjectId-validated in that list query. The returned reservations remain organization-scoped.

## 8. Database / Persistence

All Phase 2 models use Mongoose with timestamps and organization references. List operations use MongoDB filtering, sorting, pagination, and `countDocuments` in parallel. Reservation creation and update perform application-level reads and overlap checks before writing; no MongoDB transaction or database-level schedule exclusion constraint is configured.

The empty `src/config/` and `src/validators/` directories contain no additional Phase 2 database or validation components. Validation is implemented inside services and Mongoose schemas.

## 9. Testing

- Test file: `src/testPhase2.ts`.
- Command used by the repository: `npx ts-node src/testPhase2.ts`.
- No `test:phase2` npm script exists in `package.json`.
- The test connects to `MONGODB_URI` or the local `doybiz_test` fallback and clears the test collections before running.
- Covered scenarios: organization/owner registration, branch creation, customer creation, staff creation, service creation, StaffService assignment, reservation creation, overlapping booking rejection, back-to-back booking acceptance, and public reservation creation.
- Current result: the available Phase 2 test passed against the configured MongoDB instance.
- `npm run build` passed after this documentation was created.

## 10. Files Created / Modified

### Core Phase 2 implementation files

- `src/models/Customer.ts`
- `src/models/Staff.ts`
- `src/models/Service.ts`
- `src/models/StaffService.ts`
- `src/models/StaffServiceMapping.ts` (present model; not used by the main Phase 2 service flow)
- `src/models/Reservation.ts`
- `src/services/customerService.ts`
- `src/services/staffService.ts`
- `src/services/serviceService.ts`
- `src/services/reservationService.ts`
- `src/controllers/customerController.ts`
- `src/controllers/staffController.ts`
- `src/controllers/serviceController.ts`
- `src/controllers/reservationController.ts`
- `src/controllers/publicReservationController.ts` (legacy controller still present)
- `src/routes/customerRoutes.ts`
- `src/routes/staffRoutes.ts`
- `src/routes/serviceRoutes.ts`
- `src/routes/reservationRoutes.ts`
- `src/routes/publicRoutes.ts`
- `src/utils/timeHelper.ts`
- `src/testPhase2.ts`

Phase 2 also relies on Phase 1 files `src/models/Organization.ts`, `Branch.ts`, `User.ts`, `src/middlewares/auth.ts`, and `src/utils/branchAccess.ts`.

### Phase 2 documentation

- `docs/PHASE_2_CUSTOMER_RESERVATION.md` (this file)

The implementation files were inspected but not modified for this documentation task.

## 11. Dependencies / Integration

Phase 2 consumes Phase 1 authentication, roles, organization IDs, branches, and branch access. Phase 3 uses Reservation, Customer, Service, and branch relationships for reservation-to-sale conversion; a reservation is not itself a sale. Phase 4 aggregates reservations, customers, services, and future sales. Phase 5 reuses the public reservation service and shared validation through domain-based tenant resolution.

## 12. Known Limitations

- No business-hours or staff-schedule model exists in Phase 2; Phase 5 availability uses its documented fallback window.
- No database transaction or database-level unique appointment-slot constraint protects concurrent reservation requests.
- Customer phone is indexed but not schema-unique within an organization; public creation uses an application-level find/create sequence.
- `StaffServiceMapping` exists alongside `StaffService`, but the active service flow uses `StaffService`.
- Authenticated reservation update permits `CASHIER` according to the current route.
- Authenticated reservation list filters for `staffId` and `customerId` validate format but do not add a separate branch relationship check beyond the organization-scoped query.
- No dedicated Phase 2 npm test script exists.
- Notifications, reminders, waitlists, recurring appointments, and payment collection are not part of Phase 2.

## 13. Phase Status

COMPLETE for the implemented Phase 2 scope exercised by `src/testPhase2.ts`: customer, staff, service, staff-service, reservation, public reservation creation, validation, branch access, and overlap prevention are present and tested. The limitations above are unimplemented features or architectural constraints, not undocumented behavior.
