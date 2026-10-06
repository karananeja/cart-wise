# Test Plan

**Feature:** F-014 — EMI (normal and no-cost) and Razorpay payments (test mode)

## 1. Scope

**Tested:**
- EMI maths and eligibility;
- EMI payments and offer stacking;
- Razorpay configuration, start, verification, capture, reconcile, webhooks, late payments and refunds;
- the database upgrades;
- the product page, payment page, confirmation, order page and console;
- the full journeys.

**Not tested automatically:**
- Razorpay's real Checkout and API. Every automated test runs against a fake; a real test-mode payment and refund with your keys is a manual check (§4).
- Visual polish, checked with screenshots.

## 2. Risk areas

- **Money:**
  - wrong instalments or a "No Cost" label that isn't exactly true;
  - no-cost EMI stacked with a bank offer;
  - Razorpay paid amount not matching the order.
- **Trust:**
  - an order confirmed on a forged or mismatched Razorpay response;
  - a double confirmation or double refund;
  - a late payment kept.
- **Secrets:** the key secret leaking to the browser or logs; live keys accepted.
- **Upgrade:** the `payment_attempts` rebuild losing rows or indexes.
- **Availability:** Razorpay down breaking the demo payment.

## 3. Tests

| Level | Area | Cases | File |
|---|---|---|---|
| Unit | EMI | Reducing-balance instalments and rounding; no-cost charged and discount; instalments sum to the price, the last one takes the rounding; eligibility (no card, debit, other bank, below ₹3,000); plan lists (no-cost from ₹10,000, normal after the offer); product-page lowest EMI | `packages/shared/src/emi.test.ts` |
| API | EMI | Quote plans (with and without an offer, debit card); normal EMI with a bank offer recorded on the order; no-cost EMI charged and recorded, cancellation refund; no-cost + offer refused; invalid tenure, no-cost tenure, debit, other bank; unknown keys refused; minimums | `apps/api/src/payments/emi.api.test.ts` |
| API | Razorpay | Test keys only (live, missing secret, non-local base URL refused); config has no secret; labels; order creation and Checkout options; tampered signature refused; capture of an authorised payment; idempotent repeat; amount mismatch refused unless Razorpay applied an offer; reconcile on close; late payment auto-refund (once); Razorpay down → 502 and the demo payment still works; secret never logged; signed webhooks confirm once, unsigned refused, off without a secret; cancellation refund through Razorpay; refund failure stays initiated, operator retry, no double refund | `apps/api/src/payments/razorpay.api.test.ts` |
| Integration | Upgrade | Pre-F-014 `payment_attempts` rebuilt with rows and indexes kept; Razorpay method then allowed | `apps/api/src/db/database.test.ts` |
| API | Regressions | Payment analytics events carry `provider` and EMI fields | `apps/api/src/payments/payments.test.ts` |
| Component | Product page | EMI line with No Cost; plans dialog per bank; hidden below ₹3,000 | `apps/web/src/features/payment/Emi.test.tsx` |
| Component | Payment | No Cost EMI removes the bank offer with a note; summary discount, "Charged today" and plan; only the plan (no offer) sent; confirmation shows the plan; plan required in EMI mode; debit card explained | same |
| Component | Razorpay | Tab hidden unless configured; Checkout opened with key, amount and prefill; confirmed after verification; failed verification message; dismiss and retry; script load failure | same |
| E2E | Journeys | Product EMI line → No Cost EMI on an Aurora credit card → OTP → order records the plan (instalments sum to the total). Razorpay tab against the fake → confirmation with the Razorpay label → cancel → refunded through Razorpay. EMI plans at 360 px | `e2e/emi-razorpay.spec.ts`, `e2e/fake-razorpay-server.ts` |

## 4. Manual verification

- **Screenshots:**
  - the product page and the EMI plans dialog at 1280 px and 360 px;
  - the payment page with No Cost EMI selected.
- **Upgrade:** your `store.db` upgraded on restart. The `payment_attempts` rebuild kept all 4 attempts and 4 paid orders, with indexes and no leftover table.
- **Live-key refusal:** an API started with `rzp_live_…` logs the refusal and `/api/payments/config` reports Razorpay off.
- **Pending (needs your test keys):**
  - one Razorpay Checkout payment by test card (e.g. 4100 2800 0000 1007);
  - one by UPI `success@razorpay`;
  - one EMI payment;
  - one cancellation refund visible in your Razorpay Dashboard (Test Mode).

## 5. Results

| Run date | Command | Result | Notes |
|---|---|---|---|
| 2026-10-06 | `pnpm test` | 484 passed (shared 43, api 259, web 182) | |
| 2026-10-06 | `pnpm e2e` ×9 | 56 passed on 8 runs; 1 run had one failure in the existing wishlist size test (passed alone and on the 8 other runs; trace overwritten before it could be read) | Logged in the backlog |
| 2026-10-06 | `pnpm typecheck`, `pnpm build` | Clean | Main bundle 421 kB |
