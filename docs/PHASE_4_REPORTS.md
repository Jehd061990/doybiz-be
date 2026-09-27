# Phase 4 Reports and Dashboard

## Status

PARTIALLY COMPLETE. The report and dashboard backend is implemented and the empirical MongoDB suite passes. The phase remains partial because refund accounting, inventory, and a frontend dashboard are intentionally outside this phase.

## Architecture

`reportController` remains thin and delegates to `reportService`. Sales, payment, and SaleItem reports use MongoDB aggregation pipelines. Reservation and customer summaries use tenant-scoped aggregation/count queries. The dashboard composes the same report service methods rather than creating a second calculation system.

## Endpoints and Roles

| Method | Endpoint | Purpose | Required role |
| --- | --- | --- | --- |
| GET | `/api/reports/sales/summary` | Revenue, discounts, tax, collections, outstanding balance | OWNER, MANAGER |
| GET | `/api/reports/sales/daily` | Sales grouped by business date | OWNER, MANAGER |
| GET | `/api/reports/sales/monthly` | Sales grouped by business month | OWNER, MANAGER |
| GET | `/api/reports/sales/by-branch` | Sales by accessible branch | OWNER, MANAGER |
| GET | `/api/reports/sales/by-service` | Historical service snapshot quantity and revenue | OWNER, MANAGER |
| GET | `/api/reports/sales/by-cashier` | Sales by cashier | OWNER, MANAGER |
| GET | `/api/reports/payments/by-method` | Completed payment totals by method | OWNER, MANAGER |
| GET | `/api/reports/payments/summary` | Paid, partial, and unpaid sale totals | OWNER, MANAGER |
| GET | `/api/reports/reservations/summary` | Reservation status counts | OWNER, MANAGER, CASHIER |
| GET | `/api/reports/customers/summary` | Customer totals and new customers | OWNER, MANAGER, CASHIER |
| GET | `/api/reports/services/top` | Ranked service snapshots | OWNER, MANAGER |
| GET | `/api/dashboard/summary` | Sales, transactions, reservations, and customer KPIs | OWNER, MANAGER |

## Filters and Dates

Reports accept `startDate`, `endDate`, and where relevant `branchId` and `limit`. Dates must be valid `YYYY-MM-DD` values and `startDate` cannot be after `endDate`. If omitted, reports default to the current business day. Dashboard metrics default to today, the last seven calendar days, and the current business month. Business-day boundaries and grouping use `BUSINESS_TIMEZONE`, defaulting to `Asia/Manila`; sale/payment timestamps remain the existing `createdAt`/`paidAt` fields.

## Financial Rules

- Active revenue uses only `Sale.status = COMPLETED`; voided sales do not contribute.
- Gross sales is the sum of `Sale.subtotal`; discounts and tax use the stored Sale fields; net sales is the sum of `Sale.total`.
- Collected revenue is the sum of `Sale.amountPaid`; outstanding amount is `total - amountPaid`.
- Payment method totals use completed `Payment.amount` grouped by `Payment.paymentMethod` and `paidAt`.
- Service analytics use `SaleItem.name`, `quantity`, and `total` snapshots, preserving historical names/prices.
- `REFUNDED` exists in Phase 3 as a foundation, but no complete refund settlement workflow exists; refunded-sale analytics are therefore excluded from active revenue and are not presented as fabricated refund totals.

## Security and Branch Access

Every query derives `organizationId` from the authenticated user. Explicit branches are validated against that organization and `canAccessBranch`. Without an explicit branch, OWNER or `branchAccess = ALL` sees all organization branches; other roles are restricted to their assigned branches. Financial reports and dashboard are restricted to OWNER/MANAGER, while CASHIER receives only reservation/customer operational summaries.

Customer summaries for branch-limited users include customers referenced by accessible-branch sales or reservations, since the existing Customer model is organization-scoped rather than branch-scoped.

## Performance

Sales, SaleItem, and Payment metrics use `$match`, `$group`, `$lookup`, `$project`, `$sort`, and `$limit` in MongoDB. Existing indexes support organization/branch/date, status, cashier, sale, and payment date lookups. No broad collection is loaded into Node.js for financial aggregation. Existing Phase 3 indexes were preserved; no speculative indexes were added.

## Testing

- `npm run build` passes.
- `npm run test:phase4` passes against the configured MongoDB instance.
- The suite covers report calculations, daily/monthly grouping, branches, services, cashiers, payment methods/statuses, reservation/customer/service summaries, dashboard metrics, tenant isolation, manager branch restrictions, invalid dates, and reversed ranges.

Inventory, refunds, accounting, subscriptions, and frontend UI remain out of scope.