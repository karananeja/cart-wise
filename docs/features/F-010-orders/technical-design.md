# Technical Design — F-010 Orders

**Status:** Implementation
**Inputs:** specification.md (approved 2026-10-06), F-008 orders and holds, F-009 payments, ADR-003 (sessions, rate limiting)

## 1. Shared (`packages/shared/src/orders.ts`)

**Lifecycle:**
- `ORDER_FLOW` = confirmed → processing → shipped → out_for_delivery → delivered;
- `nextStatus(status)`;
- `CANCELLABLE` = confirmed, processing;
- `RETURN_WINDOW_MS` = 7 days;
- `DELIVERY_CODE_ATTEMPTS` = 3.

**Reasons:**
- `CANCEL_REASONS`;
- `RETURN_REASONS` (ids and labels).

**`allocatePaise(totals, amount)`:**
- shares an amount in proportion to the line totals, using the largest-remainder method;
- the shares are exact to the paisa and add up to the amount;
- it is used to share the bank offer across lines.

**Types:**
- the `Order` additions: line `id`, `deliveredAt`, `cancelledAt`, `cancelReason`, `returns`, `refunds`, `deliveryCode`, `actions` and `returnState`;
- `OrderSummary` (list cards);
- `OrderReturn`;
- `OrderRefund`;
- `SimOrder`.

`OrderStatus` gains `processing`, `shipped`, `out_for_delivery` and `delivered`. `OrderHistoryStatus` gains those plus `cancelled`.

## 2. Data (additive)

```sql
orders + delivered_at, cancelled_at, cancel_reason            (ensureColumn)
order_status_history                                           (F-009, more statuses)
delivery_codes(order_id PK FK, code, attempts, issued_at)      -- plain: it is shown to the owner
returns(id 'RET-…' PK, order_id FK, status ('requested'|'picked_up'|'refunded'), created_at, picked_up_at, refunded_at)
return_lines(return_id FK, order_line_id UNIQUE FK, reason, refund_paise)   -- UNIQUE: a line returns once
refunds(id 'RF-…' PK, order_id FK, return_id NULL FK, amount_paise, label, status ('initiated'|'refunded'), initiated_at, refunded_at)
operator_sessions(token_hash PK, created_at, expires_at)
```

## 3. API services

### Order view (`orders/service.ts`)

`toOrder` gains:
- line ids;
- returns, with their lines;
- refunds;
- `deliveryCode` (customer view only, while Out for Delivery);
- `actions`:
  - `canCancel`: the status is one of `CANCELLABLE`;
  - `canReturn`: the order is Delivered, the window is still open, and some line is unreturned;
  - `returnWindowEndsAt`;
- `returnState` (`none` / `partial` / `all`).

### Lifecycle (`orders/lifecycle.ts`)

The service takes the database, the order service, the event recorder and the clock. Every write is one transaction guarded by the current status (`UPDATE … WHERE status = ?`), so a second identical call finds nothing to change and is refused.

**Customer actions:**
- **`list(userId, cursor)`:** keyset pagination on `(created_at, id)` DESC, 10 per page. Lists paid orders only (`paid_at IS NOT NULL`).
- **`cancelPaid(userId, orderId, reason, visitorId)`:** Order Confirmed or Processing → `cancelled`. It then:
  1. restocks (`on_hand += q`);
  2. inserts a refund of `paid_paise` with status `refunded`, `initiated_at = refunded_at = now`;
  3. adds a history step;
  4. records `order_cancelled`.
- **`requestReturn(userId, orderId, lines)`:** checks that:
  - the order is Delivered and still within its window;
  - every line belongs to the order and hasn't been returned;
  - every reason is valid.

  Each line's refund is its line total minus its share of the offer, from `allocatePaise` over **all** order lines. The shares are fixed per line, so any combination of returns stays within the amount paid.

**Operator actions:**
- **`advance(orderId)`:** moves to the next status, unless that's Delivered. Entering Out for Delivery issues a code.
- **`deliver(orderId, code)`:**
  - refuses with `423 DELIVERY_LOCKED` once the attempts reach 3;
  - a wrong code adds an attempt and answers `401 INVALID_CODE { attemptsLeft }`;
  - a right code → `delivered`, `delivered_at`, history, and deletes the code.
- **`issueCode(orderId)`:** Out for Delivery only. Replaces the code and resets the attempts.
- **`pickUp(returnId)`:** `requested` → `picked_up`. Restocks the returned lines and inserts an `initiated` refund for the sum of the lines' refunds.
- **`completeRefund(returnId)`:** `picked_up` → `refunded`. Sets the refund to `refunded`.
- **`simList()`:** the 50 most recent paid orders, showing the city only.

### The cancel route

`POST /orders/:id/cancel` branches on the order's status:
- **Pending Payment:** the F-008 `cancel`;
- **Order Confirmed or Processing:** `cancelPaid`;
- **anything else:** `409 NOT_CANCELLABLE`.

## 4. Operator access (`sim/`)

- **`operator.ts`:**
  - the password comes from `options.operatorPassword`, which falls back to `SIM_OPERATOR_PASSWORD` and then `demo-operator`;
  - comparison is in constant time, using SHA-256 digests of both values;
  - a cookie, `sim_operator` (httpOnly, sameSite lax), lasts 8 hours; only the token's hash is stored;
  - failures are limited per IP by `createLoginLimiter`.
- **Routes:** `POST /api/sim/session`, `GET /api/sim/session` (status), `DELETE /api/sim/session`. Every other `/api/sim/*` route answers `401 OPERATOR_REQUIRED` without the operator cookie.
- **Startup:** `server.ts` logs a notice when the default password is in use.

## 5. Web

### Customer pages (`features/orders/`)

- **Your orders** (`/account/orders`), built on `useInfiniteQuery`, with an `OrderCard` that includes `DeliveryCode` when present.
- **Order page** (`/orders/:id`):
  - `OrderTimeline`: an `<ol>` with each step's state in text;
  - `OrderItems`, with return badges;
  - `PaymentAndRefunds`;
  - `DeliveryCode`;
  - the action: `CancelOrderDialog` or `ReturnItemsDialog` (a select step, then reasons, then a confirmation showing the refund).
- Pending orders redirect to the payment page.
- The confirmation page gains **View order**. The account page and menu gain **Your orders**.

### Operator page (`features/sim/SimOrdersPage.tsx`, `/sim/orders`)

- A sign-in form when signed out.
- A table or cards of orders, each with:
  - Advance to next step;
  - code entry and Issue new code (Out for Delivery);
  - per return: Mark picked up and Complete refund.
- Sign out.
- A "Demo operator — simulation only" banner.
- The page is outside the customer header actions but uses the same layout.

### Mocks

`test/ordersServer.ts` and `test/simServer.ts`.
