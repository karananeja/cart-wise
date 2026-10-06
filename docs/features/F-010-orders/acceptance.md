# Acceptance

**Feature:** F-010 — Orders (history, details, lifecycle, cancellation, returns, refunds, delivery OTP)
**Status:** Accepted (Gate 2, 2026-10-06)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Your orders: paid orders only, newest first, 10 at a time with Show more; cards show status, date, thumbnails and total; empty state | Pass | API (unpaid hold excluded; 12 orders paged 10 + 2; ownership); `Orders.test.tsx`; E2E mobile (empty state, then card) |
| 2 | Order page: timeline with times, items, payment, address, next action; confirmation links to it | Pass | `Orders.test.tsx`; E2E (View order → timeline) |
| 3 | The operator advances one step at a time; each step shows on the timeline; skipping or going back is refused | Pass | API (history times, `INVALID_TRANSITION`); E2E |
| 4 | Cancel only in Confirmed or Processing: immediate refund of the amount paid, restock, `order_cancelled`, never twice; from Shipped, the return explanation | Pass | API (refund ₹7,200 incl. offer, stock 8 → 10 once, event once, 409 twice and from Shipped); E2E (cancel while Processing, stock 6 → 7) |
| 5 | 4-digit code on Out for Delivery, owner only (order page and card); wrong code shows attempts left; locked after 3 until a new code; the new code is shown | Pass | API (not in operator or other-customer responses; 2 → 1 → 423; reissue resets); E2E (wrong, then right code) |
| 6 | Returns within 7 days only; selected items; one reason each; an item can't be returned twice | Pass | API (`NOT_DELIVERED`, `RETURN_WINDOW_CLOSED` at 7 days, `ALREADY_RETURNED`, bad requests); E2E |
| 7 | Each item's refund = line total minus its offer share, no delivery charge; refunds never exceed the amount paid | Pass | Shared `allocatePaise` tests; API (₹2,000 − ₹200 = ₹1,800; ₹6,000 − ₹600 = ₹5,400; sum = paid; delivery ₹49 not refunded); dialog preview uses the same rule |
| 8 | Return stages visible with times; restock at pickup; Returned or Partly returned | Pass | API (restock once, refund `initiated` → `refunded`); E2E (stock +1 at pickup, refund initiated, then refunded) |
| 9 | No cross-customer access; operator routes need the operator session (customers refused); wrong passwords limited | Pass | API `lifecycle.test.ts` and `sim.test.ts` (401 for every operator route, customer session refused, 5 tries then 429, 8-hour expiry) |
| 10 | Keyboard and screen reader (timeline, dialogs, delivery code); 360 px | Pass | Timeline is an `<ol>` with each state in text and `aria-current="step"`; code read digit by digit; Radix dialogs; E2E mobile (no horizontal scroll) |

## 2. Test results summary

- 380 unit, API and component tests (shared 38, API 203, web 139).
- 43 E2E tests, 4 of them new, passing on 3 repeated runs.
- Typecheck and build clean.

## 3. Known issues and limitations

- **No automatic progression:** orders move only when the operator advances them. F-011 may add automation.
- **No damaged-stock write-off:** returned units go back on sale at pickup whatever the reason.
- **Operator password:** a single shared demo password, `demo-operator` by default. It's documented in the README, and the API logs a notice when the default is in use. It is not a production authorisation model.
- **Rate limit memory:** the operator rate limit is kept in memory, as in F-006, so it resets when the API restarts.

## 4. Deviations from the approved specification

None.

## 5. Other changes

- **Return dialog overflow fixed (Gate 2 review, 2026-10-06).** Long item names pushed the return dialog's content past its edge; at 360 px the prices and Back button were cut off. Two causes:
  - The shared dialog's grid track could not shrink below its widest unwrapped line. The track now shrinks, which also protects every other dialog.
  - The return rows kept titles and reasons on one line. Titles now wrap, reasons sit on their own line, and prices stay visible.

  The dialog is also wider on desktop (512 px). A new E2E test checks it with long names at 360 px; it fails without the fix.

- **README:** now documents the demo cards, the on-screen codes and the operator password, and corrects the stated price rate (₹96 = $1).
- **F-009 API test updated:** it asserted that a paid order could not be cancelled, which F-010 now deliberately allows.
- **Paid-order redirect:** the payment page now sends a paid order past Confirmed to its order page.

## 6. Documentation updated

- [x] specification.md, intent.md, technical-design.md, test-plan.md, conversation-log.md
- [x] open-questions (Q6, Q9, Q14, Q16), project-plan, project-state, conversation log, README

## 7. User sign-off (Gate 2)

- [x] Accepted by user — date: 2026-10-06
