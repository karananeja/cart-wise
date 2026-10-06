# Acceptance

**Feature:** F-009 — Simulated payment (card, UPI, card offers)
**Status:** Accepted (Gate 2, 2026-10-06)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Product banner shows the best saving (₹6,000 → Aurora ₹600), is hidden at ₹800, and All offers lists the three demo offers | Pass | `payment.test.ts` (shared); `Offers.test.tsx`; E2E (₹1,500 cap on a laptop) |
| 2 | No offer preselected; Aurora + Aurora card → −₹600, "Pay ₹5,400"; mismatch reason; Apply hint; "Add ₹X more" | Pass | API quote tests; `Payment.test.tsx`; E2E; screenshots |
| 3 | One offer only; the server checks it, and an ineligible offer is refused | Pass | API (`OFFER_NOT_APPLICABLE`, amount from the server) |
| 4 | Any Luhn-valid number; only the first 6 and last 4 digits sent; no full number, expiry or CVV stored | Pass | API (strict body, `INVALID_CARD` for extra keys, no such columns or values); component test of the request body; E2E request capture |
| 5 | Success + OTP: confirmed with both history steps; held stock becomes a sale; ordered items leave the cart; confirmation page | Pass | API; E2E (on hand 6 → 5, reserved 0; cart emptied) |
| 6 | 0002 declined and 9995 insufficient funds; 3 wrong OTPs; order, hold and cart kept; Try again | Pass | API; E2E (decline → retry with another card) |
| 7 | UPI ID approve, decline, 5-minute expiry, cancel | Pass | API; E2E (approve) |
| 8 | QR encodes `demo-payment://pay?orderId=…&amount=…`; Simulate scan → result | Pass | API; E2E (QR shown, decline) |
| 9 | No payment after the hold expires, including a late approval | Pass | API (injected clock) |
| 10 | Double approval completes once and reduces stock once | Pass | API (concurrent approvals; events counted once) |
| 11 | No cross-customer access to quote, payments or approval | Pass | API (404 for another customer, 401 signed out) |
| 12 | `payment_started`, `payment_failed` (reason), `payment_completed` and `order_created`, each once | Pass | API (server-recorded at the state change) |
| 13 | Keyboard and screen reader; 360 px with a sticky Pay bar | Pass | E2E mobile (bar, no horizontal scroll, demo app in view); native radios and tabs; status and alert regions |

## 2. Test results summary

- 349 unit, API and component tests (shared 35, API 188, web 126).
- 39 E2E tests, 5 of them new, passing on 3 repeated runs.
- Typecheck and build clean.

## 3. Known issues and limitations

- **Simulated card trust:** the server takes the first 6 and last 4 digits on trust. That's acceptable only because payment is simulated (spec §15).
- **Order pages:** order history and order details pages arrive in F-010; the confirmation page is reachable by its URL.
- **Silent cancel:** cancelling the bank OTP step or a UPI request returns to the form without an error message. The attempt is still recorded as failed (`cancelled`) for analytics.
- **Tab switching:** switching between the Card and UPI tabs resets that tab's form and offer choice.
- **Sticky bar:** the mobile sticky Pay bar is on the Card tab only; the UPI actions are in the page flow.

## 4. Deviations from the approved specification

None.

## 5. Other changes

- **Cart E2E test race fixed:** the cart E2E test "a stock drop flags the line" now waits for the server to store the new quantity before changing stock. This race was already in the test; the larger parallel suite made it show up.

## 6. Documentation updated

- [x] specification.md, intent.md, technical-design.md, test-plan.md, conversation-log.md
- [x] project-state, project-plan, conversation log

## 7. User sign-off (Gate 2)

- [x] Accepted by user — date: 2026-10-06
