# Test Plan

**Feature:** F-010 — Orders (history, details, lifecycle, cancellation, returns, refunds, delivery OTP)

## 1. Scope

**Tested:**
- order list and order page;
- lifecycle transitions;
- paid cancellation (refund and restock);
- delivery code;
- returns and staged refunds;
- the offer share-out;
- ownership;
- operator access.

**Not tested:** visual polish of the timeline (manual).

## 2. Risk areas

- **Double effects:** cancelling, restocking or refunding twice.
- **Refund maths:** the offer share-out must be exact to the paisa and must never exceed the amount paid.
- **Return window boundary** at exactly 7 days.
- **Delivery-code exposure:** the code must not reach anyone but the owner, nor the operator API.
- **Operator access:** customers must not be able to call operator routes; the password limit must hold.
- **History list:** unpaid holds must not leak into the order history.

## 3. Tests

| Level | Area | Cases | File |
|---|---|---|---|
| Unit | Shared | `nextStatus`; `allocatePaise` (exact sum, proportional, zero amount, single line, odd remainders) | `packages/shared/src/orders.test.ts` |
| API | List/view | Paid only, newest first, paging cursor, ownership, actions per status | `apps/api/src/orders/lifecycle.test.ts` |
| API | Lifecycle | Advance step by step; no skipping; Delivered only by code; history times | same |
| API | Cancel | Confirmed and Processing → refund of the amount paid (including delivery), restock once, `order_cancelled` once; refused from Shipped; twice refused | same |
| API | Delivery code | Created on Out for Delivery; owner-only, never in operator or other-customer responses; wrong code attempts; lock after 3 (423); reissue resets | same |
| API | Returns | Window (before and after 7 days); partial; line returned twice refused; refund shares (bank offer apportioned, no delivery charge); pickup restocks once and initiates the refund; complete refund; sum ≤ paid | same |
| API | Operator | 401 without the session; a customer session doesn't count; wrong password limited; sign in/out | `apps/api/src/sim/sim.test.ts` |
| Component | Orders | List, empty state, Show more; order page per state (timeline, delivery code, refunds, actions); cancel dialog; return flow | `features/orders/Orders.test.tsx` |
| Component | Operator | Sign-in, advance, code entry and lock, return actions | `features/sim/SimOrders.test.tsx` |
| E2E | Journey | Pay → View order → operator advances → code shown → wrong then right code → Delivered → return an item → pickup → refund shown; cancel while Processing (stock restored); mobile | `e2e/orders.spec.ts` |

## 4. Manual verification

- Timeline legibility in light and dark themes.
- 360 px order page and operator page.

## 5. Results

| Run date | Command | Result | Notes |
|---|---|---|---|
