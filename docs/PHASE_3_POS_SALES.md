# Phase 3 POS and Sales

## Status

PARTIALLY COMPLETE. The Phase 3 models, API, validation, tenant isolation, branch access, and empirical test script are implemented and the test passed against the configured MongoDB instance. Reports and inventory remain Phase 4/future work.

## Models

- `Sale`: tenant, branch, cashier, customer/reservation references, immutable totals, statuses, and void audit fields.
- `SaleItem`: item snapshots with service name, price, quantity, discount, total, and duration. `SERVICE` is implemented; future item types are represented in the enum.
- `Payment`: sale payment records, payment method, cash received, calculated change, receiver, and paid time.
- `SaleCounter`: organization/branch/day counter used to generate unique human-readable sale numbers.

## Endpoints

| Method | Endpoint | Purpose | Roles |
| --- | --- | --- | --- |
| POST | `/api/sales` | Create a manual service sale | OWNER, MANAGER, CASHIER |
| POST | `/api/sales/from-reservation/:reservationId` | Convert a completed reservation into one sale | OWNER, MANAGER, CASHIER |
| GET | `/api/sales` | List/filter/paginate sales | OWNER, MANAGER, CASHIER |
| GET | `/api/sales/:id` | Retrieve sale and item snapshots | OWNER, MANAGER, CASHIER |
| PUT | `/api/sales/:id` | Update a draft sale only | OWNER, MANAGER |
| DELETE | `/api/sales/:id` | Void instead of deleting a completed sale | OWNER, MANAGER |
| POST | `/api/sales/:saleId/void` | Void a completed sale with audit data | OWNER, MANAGER |
| POST | `/api/sales/:saleId/payments` | Record a payment | OWNER, MANAGER, CASHIER |
| GET | `/api/sales/:saleId/payments` | List payments for a sale | OWNER, MANAGER, CASHIER |
| GET | `/api/sales/:saleId/receipt` | Return JSON receipt-ready data | OWNER, MANAGER, CASHIER |

## Business Rules

- Service prices are loaded from the tenant's active service record; client-provided final totals and prices are ignored.
- The server calculates item subtotals, item discounts, sale discount, tax, and total.
- Cash payments calculate change from `amountReceived`; non-cash payments have zero change.
- Payments cannot exceed the current remaining balance and update `amountPaid` and `paymentStatus` server-side.
- Only reservations with status `COMPLETED` can be converted. A tenant-scoped non-voided sale reference prevents duplicate conversion.
- Completed sales are not physically deleted. Void records preserve `voidedBy`, `voidedAt`, and `voidReason`.
- Refund status fields are present as a foundation; no refund endpoint or settlement workflow is implemented yet.
- Every sale, item, payment, and reservation lookup is organization-scoped. Branch access reuses `canAccessBranch`.
- Sale numbers use an atomic per-organization, per-branch, per-day counter and include the date and branch suffix.

## Indexes

Sales are indexed by organization, branch, sale number, customer, cashier, status, payment status, and creation time. Payments are indexed by organization, sale, branch, status, and paid time. Sale items are indexed by organization and sale. The counter has a unique organization/branch/date key.

## Consistency and Limitations

The current app does not expose a transaction/session abstraction and may run against a standalone MongoDB. Sale item creation and payment updates use defensive cleanup/rollback when the second write fails. A replica-set transaction can be introduced later without changing the API contract. Completed sale edits, refunds, inventory, and reports are intentionally out of scope.

## Testing

- `npm run build` passes.
- `npm run test:phase3` passed against the configured MongoDB instance, covering server-side totals, cash change, payment completion, reservation conversion, duplicate conversion rejection, and payment-after-paid rejection.