# Acceptance

**Feature:** F-008 — Checkout
**Status:** Pending user sign-off (Gate 2)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Guest Proceed → sign-in → back to checkout, cart intact | Pass | Component test; E2E |
| 2 | Default preselected; Change; add new returns with it selected | Pass | Component test; E2E (`addressId` set after adding) |
| 3 | No address → Add delivery address; Continue disabled | Pass | Component test; E2E mobile |
| 4 | Delivery prices and dates; ₹999 threshold; "Add ₹X more"; total updates | Pass | `checkout.test.ts`; `orders.test.ts`; component test |
| 5 | Summary lines + "Inclusive of all taxes", matching the server | Pass | Component test; API totals |
| 6 | Continue → Pending Payment, locked prices, stock held (others see less), 10-minute countdown | Pass | API test; E2E (another shopper's availability) |
| 7 | Stock changed → no order, back to cart with problem | Pass | API (all-or-nothing, last unit); component test |
| 8 | Cancel releases stock, cart unchanged | Pass | API test; E2E |
| 9 | Expiry after 10 minutes → Payment expired, released once, Back to cart | Pass | API test (injected clock); component test (expired page) |
| 10 | Restarting checkout cancels the previous hold | Pass | API test |
| 11 | No cross-customer access | Pass | API test |
| 12 | `checkout_started` once with itemCount and subtotal | Pass | Component test |
| 13 | Mobile sticky bar; keyboard/screen reader; 360 px | Pass | E2E mobile; radios in fieldsets; summary `aria-live`; countdown announces at 5 minutes, 1 minute and expiry |

## 2. Test results summary

296 unit/API/component tests; 34 E2E tests passing on 3 repeated runs; typecheck and build clean.

## 3. Known issues and limitations

- **Placeholder payment page:** the payment page offers only Cancel until F-009 adds card, UPI and offers (agreed scope).
- **Customer's view of their own hold:** while a hold is active, a customer browsing their own held product page sees the reduced availability (their cart is unaffected).
- **Delivery dates:** dates are calendar estimates with no holidays; all pincodes are serviceable.

## 4. Deviations from the approved specification

None.

## 5. Documentation updated

- [x] specification.md, intent.md, technical-design.md, test-plan.md
- [x] open-questions (Q8, Q10, Q11), project-state, project-plan, conversation logs

## 6. User sign-off (Gate 2)

- [ ] Accepted by user — date:
