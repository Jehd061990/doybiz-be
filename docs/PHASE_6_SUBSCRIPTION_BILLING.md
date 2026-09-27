# Phase 6 Subscription and Billing

## Status

PARTIALLY COMPLETE. The subscription and billing backend foundation is implemented and empirically tested. Prepaid 1/3/6/12-month terms, additional-user proration, branch-addition proration, and prepaid adjustment invoices are supported; payment gateways, automated notifications, advanced accounting, and billing UI remain out of scope.

## Pricing Model

The active `STANDARD` plan is the single pricing source:

- Setup fee: PHP 5,000, one time.
- Active branch charge: PHP 1,499 per active branch per month.
- Included users: 3 active users per branch.
- Additional user: PHP 200 per active user above the per-branch allowance.
- Currency: PHP.
- Billing interval: monthly.

Examples:

| Active branches/users | Monthly calculation | Total |
| --- | --- | ---: |
| 1 branch, 3 users | 1 x 1,499 + 0 x 200 | PHP 1,499 |
| 1 branch, 4 users | 1 x 1,499 + 1 x 200 | PHP 1,699 |
| 2 branches, 3 users each | 2 x 1,499 + 0 x 200 | PHP 2,998 |
| Branch A 5 users, Branch B 3 users | 2 x 1,499 + 2 x 200 | PHP 3,398 |

An active user with `branchAccess: 'ALL'` counts for every active branch. A user with an array of branch IDs counts only for those branches. Inactive users and inactive branches do not count.

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

## Billing Rules

Each organization receives one billing invoice per billing period. Branch additions and additional-user changes are consolidated into that invoice and do not create separate invoices. Setup invoices are created once during activation and are never included in subscription invoice totals. Subscription invoice generation is idempotent for the current period; a pending existing invoice is refreshed in place when current usage is recalculated, while paid and void invoices are immutable. This prevents user or branch changes from creating separate invoices.

For an active prepaid term, a branch or additional user addition creates an organization-level `ADJUSTMENT` BillingRecord. The adjustment remains pending until paid. Target branches and users are explicitly `INACTIVE` with `billingActivationPending: true` while unpaid, and are set `ACTIVE` only after the adjustment payment completes. The original paid subscription invoice is never changed. Future payment gateways, including Xendit later, must collect against these organization-level records rather than create an invoice for each individual change.

Additional-user charges are prorated based on the user's effective billing start date and the remaining time in the billing period. `User.billingEffectiveAt` is used when present; otherwise the existing `User.createdAt` is used. The calculation uses the actual subscription period dates: `monthlyUnitPrice * daysCharged / totalBillingDays`, rounded to two decimal places. Each prorated user line stores a user ID, branch, charged days, total period days, monthly unit price, prorated amount, effective date, and period end date without storing personal profile data.

Billing payment requests require a client-generated `idempotencyKey`; replaying the same key returns the original payment instead of creating another financial record. Paid and void records reject further payments and are not physically deleted. Invoice numbers use `INV-YYYY-000001` with an atomic yearly counter.

### Branch Proration

Branch price is PHP 1,499 per month. `Branch.billingEffectiveAt` is used when present; `Branch.createdAt` is the fallback. Newly added branches are charged with the same actual-period formula as users: `monthly branch price * charged days / total billing-period days`, rounded to two decimal places. The date convention is inclusive by calendar day: a branch effective at the start of the period receives all period days, and a branch effective on January 16 in a January 1-31 period receives 16 charged days. Existing branches covering the full period receive the full PHP 1,499 charge.

Branch invoice lines preserve branch ID, charged days, total period days, monthly unit price, prorated amount, effective date, period end, and an `isProrated` marker. Branch base lines and additional-user lines remain in the same consolidated BillingRecord.

There is no automatic period rollover. The current period is calculated monthly from subscription activation. Activation is idempotent for `TRIAL`/`ACTIVE` subscriptions and rejects cancelled, expired, suspended, or past-due subscriptions. Cancellation is idempotent for an already cancelled subscription. The estimate is always calculated from current active branches/users and the active plan; client pricing values are ignored.

### Branch Removal Policy

Branch deactivation/removal does not automatically generate a refund, historical credit, or debit. A deactivated branch is excluded from future billing calculations. Because the system has no branch usage ledger or deactivation-effective-date history, it does not invent a historical adjustment for a branch deactivated during the current period. Pending invoice recalculation reflects the current active-branch snapshot; paid and void invoices remain immutable. Additional-user removal follows the same snapshot policy: inactive users generate no additional-user charge when the pending period invoice is calculated.

## Authorization and Tenant Isolation

All billing services derive `organizationId` from `req.user.organizationId`. Billing and subscription records are queried with that organization ID, preventing cross-organization access. OWNER and MANAGER can view subscription/estimate/history. Only OWNER can activate, cancel, generate invoices, or record billing payments. CASHIER has no organization-level billing access.

Existing owner protection was not rebuilt in Phase 6. The master plan records a prior gap around last-owner deletion/demotion; Phase 6 leaves that unrelated user-management behavior unchanged.

## Subscription Access

`getSubscriptionAccess` is reusable for future enforcement middleware. It reports whether a `TRIAL` or `ACTIVE` subscription has a current period that has not ended. Existing Phase 1–5 routes are not automatically blocked by subscription status.

## Testing

- `npm run build` passes.
- `npm run test:phase6` passes against the configured MongoDB instance.
- Coverage includes 1/3/6/12-month prepaid terms, upfront term totals, no duplicate term invoice, the two-branch PHP 3,398 example, full-period/mid-period/near-end branch additions, 30-day and 31-day periods, multiple consolidated branches, full-period/mid-period/near-end additional users, multiple consolidated user additions, inactive-user exclusion, add-then-remove behavior, setup fee idempotency, one invoice per period, pending adjustment refresh, unpaid activation blocking, paid adjustment activation, renewal inclusion, partial/full payments, idempotency-key replay, paid/void invoice protection, lifecycle guards, cancellation, and cross-organization isolation.

## Limitations

No PayMongo, GCash, Maya, Stripe, bank verification, webhooks, card tokenization, automatic email/SMS notifications, branch usage credits/refunds, automatic renewal execution, coupons, tax/accounting, or frontend billing UI is implemented. Payment gateway integration, including Xendit later, is designed to attach payments to the organization's existing consolidated BillingRecord or prepaid adjustment BillingRecord and must not create separate payment invoices for individual branch or user changes.