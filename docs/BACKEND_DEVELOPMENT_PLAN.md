# DoyBiz Backend Development Plan

**Project:** DoyBiz
**Backend Project Folder:** `doybiz-be`
**Documentation Folder:** `doybiz-be/docs`
**Backend Stack:** Node.js + Express.js + TypeScript
**Database:** MongoDB Atlas + Mongoose
**Authentication:** JWT
**Password Hashing:** bcrypt
**Architecture:** Multi-Tenant REST API SaaS

---

# 1. PURPOSE OF THIS DOCUMENT

This file is the **MASTER DEVELOPMENT PLAN** and **PRIMARY SOURCE OF TRUTH** for the DoyBiz backend.

This file is located at:

```text
doybiz-be/docs/BACKEND_DEVELOPMENT_PLAN.md
```

Any AI coding assistant or developer working on the DoyBiz backend MUST read this document before modifying backend code.

This includes:

* GitHub Copilot
* Gemini
* ChatGPT
* Other AI coding assistants
* Future developers

The purpose of this document is to preserve:

* Existing architecture
* Development progress
* Completed features
* Development phases
* Security rules
* Multi-tenant rules
* Business rules
* API design
* Database relationships
* Future development direction

---

# 2. PROJECT STRUCTURE

Current backend structure:

```text
doybiz/
└── doybiz-be/
    ├── src/
    ├── package.json
    └── docs/
        └── BACKEND_DEVELOPMENT_PLAN.md
```

The `docs/` directory is the official documentation directory for the backend.

Future documentation should be stored inside:

```text
doybiz-be/docs/
```

Recommended future documentation:

```text
docs/
├── BACKEND_DEVELOPMENT_PLAN.md
├── PHASE_1_ORGANIZATION_AUTH.md
├── PHASE_2_CUSTOMER_RESERVATION.md
├── PHASE_3_POS_SALES.md
├── PHASE_4_REPORTS.md
├── PHASE_5_PUBLIC_WEBSITE.md
├── PHASE_6_SUBSCRIPTION_BILLING.md
└── ARCHITECTURE.md
```

Do not create development documentation randomly outside the `docs/` directory unless there is a specific reason.

---

# 3. CRITICAL AI DEVELOPMENT INSTRUCTION

Before modifying any code:

## STEP 1 — Read the master plan

Read:

```text
docs/BACKEND_DEVELOPMENT_PLAN.md
```

## STEP 2 — Read the relevant phase documentation

If a phase-specific document exists, read it.

For example:

```text
docs/PHASE_2_CUSTOMER_RESERVATION.md
```

## STEP 3 — Inspect the existing source code

Do NOT assume that something is missing.

Search the actual codebase first.

Determine:

```text
DONE
PARTIALLY DONE
MISSING
BROKEN
```

## STEP 4 — Continue from the current implementation

Do not rebuild completed functionality.

Do not replace working architecture unnecessarily.

Do not create duplicate models, routes, middleware, or services.

---

# 4. ABSOLUTE DEVELOPMENT RULE

## DO NOT START FROM SCRATCH.

The DoyBiz backend is an existing project.

The AI assistant MUST:

1. Inspect existing files.
2. Understand the existing architecture.
3. Identify existing implementations.
4. Preserve working functionality.
5. Modify only what is necessary.

If a feature already exists and works:

> KEEP IT.

If a feature exists but is incomplete:

> COMPLETE IT.

If a feature exists but is broken:

> FIX IT.

If a feature does not exist:

> IMPLEMENT IT according to this plan.

---

# 5. PRODUCT OVERVIEW

DoyBiz is a multi-tenant SaaS Business Management and Online Reservation Platform.

The platform is designed for businesses such as:

* Salons
* Spas
* Clinics
* Dental clinics
* Wellness centers
* Gyms
* Pet grooming businesses
* Service businesses
* Other appointment-based businesses

Core platform features will eventually include:

* Organization management
* Branch management
* User management
* Staff management
* Customer management
* Service management
* Online reservations
* POS
* Sales
* Payments
* Receipts
* Reports
* Public business landing pages
* Custom domains
* SaaS subscription management

---

# 6. MULTI-TENANT ARCHITECTURE

DoyBiz is a multi-tenant SaaS application.

The hierarchy is:

```text
DoyBiz Platform
       │
       ├── Organization A
       │      │
       │      ├── Branch 1
       │      ├── Branch 2
       │      └── Branch 3
       │
       ├── Organization B
       │      │
       │      ├── Branch 1
       │      └── Branch 2
       │
       └── Organization C
              │
              └── Branch 1
```

Each Organization represents a separate business/company.

Example:

```text
Organization:
Bella Salon

Branches:
- Matina
- Bajada
- Lanang
```

---

# 7. TENANT ISOLATION

Tenant isolation is a critical security requirement.

Organization-owned data must contain:

```text
organizationId
```

Protected database queries MUST filter using the authenticated user's organization.

Bad:

```ts
Model.findById(id)
```

Preferred:

```ts
Model.findOne({
  _id: id,
  organizationId: req.user.organizationId
})
```

Never allow:

```text
Organization A
      ↓
access
      ↓
Organization B data
```

Tenant isolation applies to:

* Customers
* Staff
* Services
* StaffService
* Reservations
* Sales
* Payments
* Inventory
* Reports
* Future organization-owned modules

---

# 8. ORGANIZATION

Organization represents the company/business using DoyBiz.

Example:

```text
Bella Salon
```

Organization-level information may include:

* Business information
* Owners
* Subscription
* Company settings
* Organization configuration

---

# 9. BRANCH

An Organization may have multiple branches.

Example:

```text
Bella Salon
│
├── Matina
├── Bajada
└── Lanang
```

Branch belongs to exactly one organization.

Conceptually:

```text
Branch
- organizationId
- name
- address
- contact information
- status
```

Branch access must be enforced for users who are restricted to specific branches.

---

# 10. USER VS STAFF

This distinction MUST always be preserved.

## User

A User is a DoyBiz system login account.

Example:

```text
Maria
Role: OWNER
```

Users authenticate using:

```text
email
password
```

Users have roles and permissions.

---

## Staff

Staff represents an employee or service provider.

Examples:

```text
Hair Stylist
Barber
Nail Technician
Therapist
Technician
```

A Staff member does NOT automatically need a DoyBiz login.

Therefore:

```text
User != Staff
```

Never merge these concepts unless explicitly approved.

---

# 11. USER ROLES

Current roles:

```text
OWNER
MANAGER
CASHIER
```

---

## OWNER

Owner is organization-level.

Owner has full organization access.

Owner can access:

* Dashboard
* Branches
* Users
* Staff
* Customers
* Services
* Reservations
* POS
* Sales
* Reports
* Settings
* Subscription/Billing

Owner may also use POS/Cashier functionality.

---

## MANAGER

Manager is primarily an operational role.

Manager can access:

* Customers
* Staff
* Services
* Reservations
* Operational reports
* POS where permitted

Manager must respect branch access restrictions.

---

## CASHIER

Cashier is a limited operational role.

Cashier may access:

* POS
* Sales
* Customer lookup
* Reservations
* Payment recording
* Receipt processing

Cashier must not receive unrestricted administrative access.

---

# 12. OWNER PROTECTION

At least one active Owner must always exist for an organization.

The last active Owner cannot:

* be deleted
* be deactivated
* lose the Owner role

Ownership transfer requires another Owner to exist first.

Multiple Owners are allowed.

Valid:

```text
Owner
Owner
Manager
```

Valid:

```text
Owner
Manager
Cashier
```

Invalid:

```text
Manager
Cashier
Cashier
```

because there is no Owner.

---

# 13. BRANCH ACCESS MODEL

Owner:

```text
Owner
  ↓
Organization
  ↓
All branches
```

Manager/Cashier:

```text
User
  ↓
Organization
  ↓
Assigned branch(es)
```

Example:

```text
Bella Salon

Owners:
- Maria

Matina:
- Ana — Manager
- Juan — Cashier

Bajada:
- Pedro — Manager
- Carlo — Cashier
```

Ana and Juan must not access Bajada unless they are explicitly assigned access.

---

# 14. AUTHENTICATION

Authentication uses:

```text
JWT
```

Passwords use:

```text
bcrypt
```

Existing authentication MUST be reused.

Do not create another authentication system.

Existing routes include:

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/users/me
```

---

# 15. AUTHORIZATION

Reuse the existing authorization architecture.

Conceptually:

```text
Request
   ↓
Authentication
   ↓
Role/Permission Authorization
   ↓
Branch Access
   ↓
Controller
   ↓
Service
   ↓
Database
```

Do not duplicate authorization logic unnecessarily.

---

# 16. BACKEND ARCHITECTURE

Preferred structure:

```text
src/
├── config/
├── controllers/
├── middlewares/
├── models/
├── routes/
├── services/
├── validators/
└── utils/
```

Preferred request flow:

```text
HTTP Request
     ↓
Route
     ↓
Authentication Middleware
     ↓
Authorization Middleware
     ↓
Validation
     ↓
Controller
     ↓
Service
     ↓
Mongoose Model
     ↓
MongoDB
```

Controllers should remain thin.

Business logic should primarily be handled inside services.

---

# 17. DEVELOPMENT PHASES & STATUS

DoyBiz backend development is divided into phases.

```text
PHASE 1 — COMPLETED
Organization + Branch + User + Authentication

        ↓

PHASE 2 — COMPLETED
Customer + Staff + Services + StaffService + Reservations + Public Reservation API

        ↓

PHASE 3 — PARTIALLY COMPLETE
POS + Sales + Payments foundation implemented; empirical MongoDB test execution remains environment-dependent.

        ↓

PHASE 4 — PARTIALLY COMPLETE
Reports + Dashboard backend implemented; empirical MongoDB tests pass. Inventory, refunds, accounting, and frontend UI remain out of scope.

        ↓

PHASE 5 — PARTIALLY COMPLETE
Public Website + Online Reservation + Custom Domain/Tenant Resolution backend implemented; business-hours configuration, domain verification automation, notifications, and frontend UI remain future work.

        ↓

PHASE 6 — PARTIALLY COMPLETE
Subscription + Billing backend foundation implemented and empirically tested; payment gateways, notifications, accounting, prorating, and frontend billing UI remain future work.
```
