# Phase 6 Subscription and Billing

## Status

PARTIALLY COMPLETE. The subscription and billing backend foundation is implemented and empirically tested. Prepaid 1/3/6/12-month terms, additional-user proration, branch-addition proration, and prepaid adjustment invoices are supported; payment gateways, automated notifications, advanced accounting, and billing UI remain out of scope.

## Pricing Model

The active `STANDARD` plan is the single pricing source:

- Setup fee: PHP 5,000, one time.
- Active branch charge: PHP 1,499 per active branch per month.
- Included organization user seats: 3 per active branch.
- Additional organization user: PHP 200 per active user above the organization's included-seat pool.
- Currency: PHP.
- Billing interval: monthly.

Examples:

| Active branches/users | Monthly calculation | Total |
| --- | --- | ---: |
| 1 branch, 3 organization users | 1 x 1,499 + 0 x 200 | PHP 1,499 |
| 1 branch, 4 organization users | 1 x 1,499 + 1 x 200 | PHP 1,699 |
| 2 branches, 6 organization users | 2 x 1,499 + 0 x 200 | PHP 2,998 |
| 2 branches, 7 organization users | 2 x 1,499 + 1 x 200 | PHP 3,198 |

Users are organization-level records. Each active user counts once regardless of whether `branchAccess` contains one branch, several branches, or `ALL`. Included seats are pooled across the organization: `active branches x 3`. Inactive users and inactive or billing-pending branches do not count.

## Prepaid Subscription Terms

Supported prepaid terms are 1, 3, 6, and 12 months through `OrganizationSubscription.paymentTermMonths`. The selected term is paid upfront in one subscription invoice. `currentPeriodStart` and `currentPeriodEnd` represent the prepaid term and no monthly subscription invoices are generated inside that active term. The next normal subscription invoice is generated for the next renewal period.

The PHP 5,000 setup fee remains one-time, is not prorated, and is not included in renewal or adjustment invoices.

## Models

- `SubscriptionPlan`: centralized pricing configuration.
- `OrganizationSubscription`: one subscription per organization, status, period, auto-renewal, and setup-fee state.
- `BillingRecord`: one organization invoice per billing period with persisted branch and prorated-user line items.
- `BillingPayment`: billing-specific payment records with required idempotency keys; the POS `Payment` model is unchanged.
- `BillingCounter`: atomic yearly invoice sequence.

## API Endpoints

| Method | Endpoint | Purpose | Role |
| --- | --- | --- | --- |
| GET | `/api/subscription` | View organization subscription | OWNER, MANAGER |
| GET | `/api/subscription/plan` | View active pricing plan | OWNER, MANAGER |
| GET | `/api/subscription/estimate` | Calculate current monthly estimate | OWNER, MANAGER |
| POST | `/api/subscription/activate` | Create the organization subscription and setup invoice; body accepts `paymentTermMonths` 1, 3, 6, or 12 | OWNER |
| POST | `/api/subscription/cancel` | Cancel auto-renewing subscription | OWNER |
| GET | `/api/billing` | List tenant billing records | OWNER, MANAGER |
| POST | `/api/billing/generate` | Generate the current subscription invoice | OWNER |
| POST | `/api/billing/adjustments` | Create or refresh one pending prepaid-term adjustment for branch/user additions | OWNER |
| GET | `/api/billing/:id` | Retrieve one invoice and payment totals | OWNER, MANAGER |
| GET | `/api/billing/:id/payments` | Retrieve invoice payments | OWNER, MANAGER |
| POST | `/api/billing/:id/payments` | Record a billing payment with an `idempotencyKey` | OWNER |
| GET | `/api/users` | List organization users without password hashes | OWNER |
| POST | `/api/users` | Create an organization user | OWNER |
| GET | `/api/users/:id` | Retrieve one organization user | OWNER |
| PATCH | `/api/users/:id` | Update role, branch access, module permissions, preset, or status | OWNER |

## Billing Rules

Each organization receives one billing invoice per billing period. Branch additions and additional-user changes are consolidated into that invoice and do not create separate invoices. Setup invoices are created once during activation and are never included in subscription invoice totals. Subscription invoice generation is idempotent for the current period; a pending existing invoice is refreshed in place when current usage is recalculated, while paid and void invoices are immutable. This prevents user or branch changes from creating separate invoices.

For an active prepaid term, a branch addition or an organization user addition above the projected included-seat pool creates an organization-level `ADJUSTMENT` BillingRecord. Each distinct user is charged at most once, independent of branch assignments. A chargeable added user remains `INACTIVE` with `billingActivationPending: true` while unpaid, and is set `ACTIVE` only after the adjustment payment completes. The original paid subscription invoice is never changed. Payment providers reconcile against these internal organization-level records rather than create separate invoices for individual branch or user changes.

Additional-user charges are prorated based on the user's effective billing start date and the remaining coverage. `User.billingEffectiveAt` is used when present; otherwise `User.createdAt` is used. Subscription estimates prorate the monthly price by charged days over the actual period. Mid-term adjustment invoices use the existing calendar-month daily proration through the prepaid term end. Each user line stores the user ID and proration metadata; branch assignment is optional and never determines user count or charge multiplicity.

Billing payment requests require a client-generated `idempotencyKey`; replaying the same key returns the original payment instead of creating another financial record. Paid and void records reject further payments and are not physically deleted. Invoice numbers use `INV-YYYY-000001` with an atomic yearly counter.

### Branch Proration

Branch price is PHP 1,499 per month. `Branch.billingEffectiveAt` is used when present; `Branch.createdAt` is the fallback. Newly added branches are charged with the same actual-period formula as users: `monthly branch price * charged days / total billing-period days`, rounded to two decimal places. The date convention is inclusive by calendar day: a branch effective at the start of the period receives all period days, and a branch effective on January 16 in a January 1-31 period receives 16 charged days. Existing branches covering the full period receive the full PHP 1,499 charge.

Branch invoice lines preserve branch ID, charged days, total period days, monthly unit price, prorated amount, effective date, period end, and an `isProrated` marker. Branch base lines and additional-user lines remain in the same consolidated BillingRecord.

There is no automatic period rollover. The current period is calculated monthly from subscription activation. Activation is idempotent for `TRIAL`/`ACTIVE` subscriptions and rejects cancelled, expired, suspended, or past-due subscriptions. Cancellation is idempotent for an already cancelled subscription. The estimate is always calculated from current active branches/users and the active plan; client pricing values are ignored.

### Branch Removal Policy

Branch deactivation/removal does not automatically generate a refund, historical credit, or debit. A deactivated branch is excluded from future billing calculations. Because the system has no branch usage ledger or deactivation-effective-date history, it does not invent a historical adjustment for a branch deactivated during the current period. Pending invoice recalculation reflects the current active-branch snapshot; paid and void invoices remain immutable. Additional-user removal follows the same snapshot policy: inactive users generate no additional-user charge when the pending period invoice is calculated.

## Authorization and Tenant Isolation

All billing services derive `organizationId` from `req.user.organizationId`. Billing and subscription records are queried with that organization ID, preventing cross-organization access. OWNER and MANAGER can view subscription/estimate/history. Only OWNER can activate, cancel, generate invoices, or record billing payments. CASHIER has no organization-level billing access.

User management is organization-scoped and owner-only. Branch IDs and module names are validated before updates; the last active owner cannot be demoted or deactivated. Permission presets supply defaults, while explicit permissions remain customizable unless `applyPreset: true` is requested. The available modules are `POS`, `SALES`, `APPOINTMENTS`, `CUSTOMERS`, `REPORTS`, `STAFF`, and `BILLING`. Protected feature routes enforce the user's role and module permissions, and service-level branch checks enforce branch assignments.

## Subscription Access

`getSubscriptionAccess` is reusable for future enforcement middleware. It reports whether a `TRIAL` or `ACTIVE` subscription has a current period that has not ended. Existing Phase 1–5 routes are not automatically blocked by subscription status.

## Testing

- `npm run build` passes.
- `npm run test:phase6` passes against the configured MongoDB instance.
- Coverage includes 1/3/6/12-month prepaid terms, organization-level seat pools, multi-branch users counted once, the six-seat/two-branch and seventh-user cases, inactive-user exclusion, branch additions increasing included seats, user proration, prepaid user adjustments, pending activation and payment activation, paid-invoice immutability, Xendit payment request and webhook reconciliation, setup fee idempotency, partial/full payments, lifecycle guards, cancellation, and cross-organization isolation.

## Limitations

No PayMongo, GCash, Maya, Stripe, card tokenization, automatic email/SMS notifications, branch usage credits/refunds, automatic renewal execution, coupons, tax/accounting, or frontend billing UI is implemented. Xendit Stage 1 creates an external payment request against the organization's existing BillingRecord. Stage 2 securely verifies webhook tokens and reconciles matching, amount- and currency-validated provider evidence into internal payment and billing records. Recurring or renewal billing is not implemented here.