# Acceptance

**Feature:** F-014 — EMI (normal and no-cost) and Razorpay payments (test mode)
**Status:** Pending user sign-off (Gate 2). A manual Razorpay check with your test keys is still to do.

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Product page "EMI from ₹X/month" from ₹3,000, "No Cost EMI available" from ₹10,000, following the selected option's price; "View plans" by bank and tenure | Pass | `Emi.test.tsx`; screenshots; E2E |
| 2 | Plans for eligible fictional credit cards with correct monthly amount, interest and total; reasons shown for debit, other banks and small orders | Pass | `emi.test.ts`; EMI API tests; `Emi.test.tsx` |
| 3 | No-cost EMI charges total − discount and the instalments add up to the price; no bank offer with no-cost; normal EMI takes the bank offer | Pass | Unit (`5 × ₹13,333 + ₹13,335 = ₹80,000`); API (refused combination, offer + normal EMI); component (offer removed with a note) |
| 4 | EMI payment through the bank OTP; plan on confirmation and order page; refunds follow existing rules | Pass | API; component; E2E |
| 5 | Razorpay tab only with test keys; live keys refused with a clear log | Pass | API config tests; manual live-key start |
| 6 | Confirm only after signature and server-side fetch; tampered signature refused; browser, reconcile and webhook confirm once | Pass | Razorpay API tests |
| 7 | Late payment after hold expiry refunded automatically, order not confirmed | Pass | API (one refund even when asked twice) |
| 8 | Cancellation and return refunds through Razorpay; a failure stays initiated with Retry | Pass | API (cancellation, failure, retry, no double refund); E2E cancellation refund |
| 9 | Razorpay unavailable → friendly message; the demo payment still works | Pass | API 502 + demo payment; component load failure |
| 10 | Keyboard, screen reader, 360 px | Pass | Native radio groups with readable names; E2E 360 px |
| — | Real Razorpay test-mode payment and refund | **Pending** | Needs your keys in `apps/api/.env` (see §6) |

## 2. Test results summary

- 484 unit, API and component tests (shared 43, API 259, web 182). That is 39 new tests.
- 56 E2E tests, 3 of them new. 8 of 9 full runs were clean; the one failure was in an existing wishlist test (see §3).
- Typecheck and build clean; main bundle 421 kB.

## 3. Known issues and limitations

- **Razorpay's no-cost EMI:** it depends on an offer in your Razorpay Dashboard (`RAZORPAY_NO_COST_EMI_OFFER_ID`). When Razorpay charges less than the total because of an offer, the difference is recorded as "Razorpay offer".
- **EMI details from Razorpay:** Razorpay EMI payments are labelled "Razorpay · EMI · card". The tenure isn't shown, because the payment fields that hold it weren't confirmed against the docs.
- **Webhooks:** they need a public URL. Locally, payments are confirmed through the browser callback, plus a reconcile when the payment page loads or Checkout is closed.
- **Paise prices:** the catalog's paise prices show in EMI interest and discounts (e.g. ₹545.70).
- **One unexplained E2E failure:** the existing "move a sized product to the cart" wishlist test failed in 1 of 9 full runs and passed in every other run and alone. The trace was overwritten; this is logged in the backlog for investigation.

## 4. Deviations from the approved specification

- **FR-3 example corrected (design):** the Gate 1 example "6 × ₹9,588 = ₹57,526" didn't add up to the price, contradicting FR-3's own rule. With the corrected formula, ₹60,000 over 6 months is 6 × ₹10,000 with ₹2,376 off, ₹57,624 charged. When the price doesn't divide evenly, the last instalment takes the rupee rounding.
- **No `/razorpay/failed` endpoint:** Razorpay Checkout lets the customer retry inside its window. Closing the window cancels the attempt after asking Razorpay whether it was paid.
- **Webhook events:** only `payment.authorized` and `payment.captured` are handled; failures need no action.

## 5. Other changes

- **Settings file:** `apps/api/.env` is loaded at start (values in the shell win), and `.env.example` documents the settings.
- **Analytics:** payment events now carry `provider`, `emiTenure` and `emiNoCost`.
- **Database:** the `payment_attempts` table is rebuilt once to allow the new method, keeping its rows.

## 6. To try it with your Razorpay test keys

1. Copy `apps/api/.env.example` to `apps/api/.env` and set `RAZORPAY_KEY_ID` (rzp_test_…) and `RAZORPAY_KEY_SECRET`.
2. **Restart `pnpm dev`** (the API reads `.env` at start). It logs "Razorpay test mode is on".
3. At payment, open the Razorpay tab. Pay with test card 4100 2800 0000 1007 (any future expiry, any CVV) or UPI `success@razorpay`.
4. Cancel the order from its page. The refund appears in your Razorpay Dashboard (Test Mode → Refunds).

## 7. Documentation updated

- [x] specification.md (FR-3 correction, rounding), intent.md, technical-design.md, test-plan.md, conversation-log.md, ADR-005
- [x] project-plan, project-state, conversation log, backlog

## 8. User sign-off (Gate 2)

- [ ] Accepted by user — date:
