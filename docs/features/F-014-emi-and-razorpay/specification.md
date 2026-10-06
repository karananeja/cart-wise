# Feature Specification

## Feature

**ID:** F-014
**Name:** EMI (normal and no-cost) and Razorpay payments (test mode)
**Status:** Approved (Gate 1, 2026-10-06) — in implementation
**Requirements:** User request (2026-10-06). It extends PAY-1..6 (F-009) and ORD-2..4 refunds (F-010).

**User decisions applied (2026-10-06):**
- **Razorpay with test keys only.** Keys starting `rzp_live_` are refused, so no real money ever moves (the CLAUDE.md payment rule is kept; ADR-005).
- **Both payment options:** the customer chooses on the payment page between the demo payment (today's card / UPI simulation) and Razorpay.
- **EMI from both:**
  - The demo payment gets its own simulated EMI (normal and no-cost).
  - In Razorpay mode, EMI comes from Razorpay Checkout.

---

## 1. Objective

Let customers spread the cost of an order over monthly instalments, with an honest no-cost option where it applies. Add a real payment gateway integration (Razorpay, test mode) next to the demo payment.

## 2. User Problem

- Phones and laptops cost ₹15,000–₹1,90,000. Indian shoppers expect to see "EMI from ₹X/month" and no-cost EMI before deciding.
- The demo payment cannot show what a real gateway checkout feels like.

## 3. User Intent

"Tell me what this costs per month, whether there's a no-cost option, and let me pay that way — or pay through a real gateway."

## 4. User Stories

- As a shopper on a product page, I want to see the lowest monthly EMI and whether no-cost EMI is available.
- As a customer paying by credit card, I want to pick an EMI plan and see the monthly amount, interest and total before I pay.
- As a customer, I want no-cost EMI to cost me exactly the order price, spread over the months.
- As a customer, I want to pay through Razorpay Checkout (card, UPI, netbanking, EMI) instead of the demo payment.
- As a customer who cancels or returns a Razorpay order, I want the refund to go back through Razorpay.

## 5. Functional Requirements

### 5.1 Simulated EMI (demo payment)

- FR-1 **Plans (D1, approved):** EMI is offered on **credit cards** from the fictional banks.

  | Bank | Interest (p.a.) | Tenures | No-cost tenures |
  |---|---|---|---|
  | Aurora Bank | 14% | 3, 6, 9, 12 months | 3, 6 |
  | Meridian Bank | 15% | 3, 6, 9, 12 months | 3, 6 |
  | Kestrel Bank | 16% | 3, 6, 9, 12 months | 3, 6 |

  - Minimum order for EMI: **₹3,000**. Minimum order for no-cost EMI: **₹10,000**.
  - Debit cards, cards from other banks and UPI have no EMI in the demo payment.
- FR-2 **Normal EMI:**
  - The monthly instalment uses the standard reducing-balance formula: EMI = P·r·(1+r)ⁿ / ((1+r)ⁿ − 1), with r the monthly rate, rounded to the rupee.
  - The store is paid the order amount. The customer repays the bank the instalments, which include the interest.
  - Example for ₹60,000 at 14%: 3 months is ₹20,468/month (₹1,405 interest), 6 months ₹10,412/month (₹2,474), 12 months ₹5,387/month (₹4,647).
- FR-3 **No-cost EMI:**
  - The interest that the plan would charge is given as an upfront **No Cost EMI discount**, so the instalments add up exactly to the order price.
  - Example: ₹60,000 over 6 months at 14% gives a ₹2,474 discount. The store is paid ₹57,526, and the customer pays 6 × ₹9,588.
  - It is labelled "No Cost EMI" only when that is exactly true.
- FR-4 **Offers (D2, approved):**
  - Normal EMI can be combined with the card's bank offer.
  - No-cost EMI **is** the order's offer, so no bank offer can be added to it. This matches the existing "one offer per order" rule.
- FR-5 **Payment page:**
  - In the demo Card tab, once an eligible credit card is recognised (from its first 6 digits, as today), a "Pay in full / Pay in EMI" choice appears.
  - EMI shows a plan list: tenure, monthly amount, interest, total, and a "No Cost" tag where it applies. The cheapest-interest option is not preselected; the customer chooses.
  - The summary and the Pay button show the amount charged today. The plan line reads "6 × ₹9,588/month".
  - The bank OTP and the demo outcome rules (decline, insufficient funds) are unchanged.
- FR-6 **Product page:**
  - Below the bank-offer banner: "EMI from ₹X/month" (the lowest monthly amount at the longest tenure). When no-cost EMI applies at this price, it adds "· No Cost EMI available".
  - "View plans" opens a dialog listing banks and tenures for the selected price. The price is the selected option's price (F-013).
  - It is hidden below ₹3,000 and when the product is out of stock.
- FR-7 **After payment:**
  - Confirmation and order pages show "Paid with Aurora Bank Visa •••• 4242 · EMI 6 × ₹10,412/month". They also show the No Cost EMI discount line when it applies.
  - The order records the plan: tenure, rate, monthly amount, no-cost discount.
- FR-8 **Refunds of EMI orders:** these follow the existing rules (paid share per item; the no-cost discount is shared out like a bank offer). The refund label notes "EMI cancelled by Aurora Bank" (informational).

### 5.2 Razorpay (test mode)

- FR-9 **Configuration:**
  - Razorpay is enabled when `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set in `apps/api/.env`, which the API loads at start.
  - Optional settings:
    - `RAZORPAY_WEBHOOK_SECRET`;
    - `RAZORPAY_NO_COST_EMI_OFFER_ID`, a No Cost EMI offer created in the Razorpay Dashboard.
  - A key starting `rzp_live_` disables Razorpay with a clear startup error, and the app keeps running with the demo payment. The key secret never leaves the server and is never logged.
  - A `.env.example` documents these settings.
- FR-10 **Payment page:**
  - A third tab, **Razorpay**, appears only when it is enabled. It is labelled "Test mode — no real money".
  - "Pay ₹X with Razorpay" opens Razorpay Checkout, prefilled with the customer's name, email and mobile. Razorpay offers card, UPI, netbanking, wallets and EMI. Its no-cost EMI shows when the Dashboard offer is configured.
  - Demo bank offers and demo EMI do not apply to Razorpay payments. The page says so.
- FR-11 **Flow:**
  1. Starting a Razorpay payment creates a Razorpay order for the order total (receipt = our order id) and a pending attempt.
  2. When Checkout reports success, the API:
     - verifies the signature (HMAC-SHA256 of `order_id|payment_id` with the key secret);
     - fetches the payment from Razorpay, captures it if it is only authorised, and checks the order and amount;
     - confirms the order exactly as the demo payment does: stock sold, cart cleaned, events.
  3. Closing Checkout cancels the attempt. A failed payment shows Razorpay's reason in plain words, with Try again.
  - The amount paid is what Razorpay captured. When a Razorpay offer (e.g. no-cost EMI) reduces it, the difference is recorded as the offer discount, and Razorpay's EMI tenure is shown when present.
- FR-12 **Holds and late payments:**
  - The 10-minute stock hold applies unchanged.
  - A payment that arrives after the hold expired is refunded automatically through Razorpay, and the attempt fails with "Your hold expired — you were not charged" (test mode).
  - If the browser closes mid-payment, the attempt is reconciled the next time the payment or order page loads: the API asks Razorpay for the order's payments.
  - A webhook endpoint (`payment.captured`, `payment.failed`) does the same when a public URL and webhook secret are configured.
- FR-13 **Refunds (D3, approved):**
  - Cancelling a paid Razorpay order, and completing a return refund, create a **Razorpay test-mode refund** through the Refunds API for the same amount the store refunds today.
  - The refund shows "Refunded to Razorpay · Visa •••• 1111" (or UPI) with Razorpay's refund id.
  - If Razorpay refuses or is unreachable, the refund stays "initiated" with a Retry action for the operator. It is never marked refunded without Razorpay's confirmation.

## 6. Non-Functional Requirements

- **Security:**
  - The server computes every amount. The signature is compared in constant time.
  - The webhook signature is checked against the raw body.
  - No card data reaches our server in either mode.
  - Only test keys are accepted.
- **Reliability:**
  - Completion happens once (idempotent), whether it comes from the browser, a reconcile or a webhook.
  - Razorpay calls time out after 10 seconds, and the customer sees a friendly retry.
- **Offline / unavailable:** if Razorpay is unreachable, the Razorpay tab shows "Razorpay is unavailable right now — use the demo payment". The demo payment is unaffected.
- **Accessibility:** the EMI plan list is a radio group, and amounts are announced. Razorpay Checkout's own accessibility is Razorpay's.
- **Responsive:** plans stack at 360 px.

## 7. UX Requirements

- One obvious primary action: Pay ₹X, with the amount charged today.
- EMI is progressive: it appears only for an eligible credit card.
- No-cost EMI is labelled honestly (FR-3), and the monthly amount is always shown with the total.
- No sign-in changes. Checkout already requires sign-in.

## 8. UI Requirements

- **Product page:** an EMI line with a "View plans" dialog.
- **Payment page:**
  - Card tab: a full-or-EMI choice and an EMI plan radio list.
  - New Razorpay tab: a test-mode note and a Pay button.
- **Summary:** "No Cost EMI discount" and plan lines.
- **Confirmation, order page, return dialog:** plan and refund lines.
- **Operator console:** Razorpay refund status and Retry.
- **States:** loading Razorpay script, opening Checkout, verifying, success, failed, cancelled, unavailable, hold expired.

## 9. Data Requirements

| Entity | Change | Ownership |
|---|---|---|
| EMI plans | Shared constants (banks, rates, tenures, minimums); pure functions for instalments and no-cost discount | Application |
| `payment_attempts` | `method` adds `razorpay`. New columns: `emi_tenure`, `emi_rate_bp`, `emi_monthly_paise`, `emi_no_cost`, `gateway_order_id`, `gateway_payment_id`, `gateway_method`. The table is rebuilt to widen the method check | Application |
| `orders` | `emi_tenure`, `emi_monthly_paise`, `emi_no_cost` (the no-cost discount reuses `offer_id` / `offer_discount_paise`), `gateway_payment_id` | Application |
| `refunds` | `gateway_refund_id`, and a failure note for retry | Application |
| Razorpay keys | Environment only; never in the database or the client (except the public key id) | Operator |

## 10. API Requirements

- `GET /api/payments/config` returns `{ razorpay: { enabled, keyId, testMode: true } }`. The secret is never included.
- `GET /orders/:id/payment-quote` adds EMI plans for the recognised card: `emi: { eligible, reason?, plans: [{ tenure, ratePercent, monthlyPaise, interestPaise, totalPaise, noCost, chargedPaise }] }`.
- `POST /orders/:id/payments`:
  - card input adds an optional `emi: { tenure, noCost }`;
  - a new `{ method: 'razorpay' }` returns the attempt with `gateway: { keyId, orderId, amountPaise, prefill }`.
- `POST /payments/:id/razorpay/verify { razorpayPaymentId, razorpayOrderId, razorpaySignature }` returns the attempt and order.
- `POST /payments/:id/razorpay/failed { code, description }` and the existing `/cancel` (Checkout closed).
- `POST /api/payments/razorpay/webhook` uses the raw body and signature header, needs no session, and is exempt from the JSON-POST guard only by its own signature check.
- `POST /api/sim/refunds/:id/retry` (operator).
- **Errors:**
  - `EMI_NOT_AVAILABLE {reason}`
  - `OFFER_NOT_APPLICABLE` (no-cost combined with an offer)
  - `GATEWAY_UNAVAILABLE`
  - `GATEWAY_SIGNATURE_INVALID`
  - `HOLD_EXPIRED`

## 11. State Management

- **Payment page:**
  - local state for the tab, the full/EMI choice and the plan;
  - server state for the quote, attempt and config.
- **Razorpay script:** loaded lazily, only when the Razorpay tab opens.

## 12. Loading States

- The plan list keeps its height while the quote loads.
- The Razorpay button shows "Opening Razorpay…" until Checkout opens, then "Confirming payment…" while the API verifies.

## 13. Empty States

- No EMI for this card: "EMI is available on Aurora, Meridian and Kestrel credit cards for orders over ₹3,000", with no plan list.
- Razorpay not configured: no tab.

## 14. Error States

- Each of these shows plain text and a retry:
  - the Razorpay script fails to load;
  - Razorpay is unreachable;
  - signature mismatch: "We couldn't confirm this payment. You have not been charged twice. Please try again or contact support";
  - hold expired, with an automatic refund.
- Raw Razorpay errors are never shown.

## 15. Security Considerations

- Test keys only. Live keys are refused (ADR-005).
- The key secret and webhook secret stay server-side and are excluded from logs and errors.
- Signature verification is constant-time. The webhook signature is checked on the raw body. Payment amounts and order ids are cross-checked with Razorpay.
- Idempotent completion prevents double sale or double confirmation.
- The demo payment keeps its rule: only the first 6 and last 4 card digits are sent.

## 16. Analytics

Existing events gain properties; there are no new event names.
- `payment_started`, `payment_completed`, `payment_failed` add `provider: 'demo' | 'razorpay'` and `emi: { tenure, noCost } | null`.
- `payment_failed` for Razorpay adds the mapped reason.

## 17. Acceptance Criteria

1. The product page shows "EMI from ₹X/month" at ≥ ₹3,000 and "No Cost EMI available" at ≥ ₹10,000, following the selected option's price. "View plans" lists banks and tenures.
2. With an eligible fictional credit card, the payment page offers EMI plans with correct monthly amount, interest and total (formula FR-2, rounded to the rupee). Debit cards, other cards, UPI and orders under ₹3,000 get no EMI, with the reason shown.
3. No-cost EMI charges order total − interest, and the instalments sum to the order price. A bank offer cannot be added to it. Normal EMI can take the card's bank offer.
4. The EMI payment completes through the bank OTP. Confirmation and order pages show the plan. Refunds of EMI orders follow the existing share rules.
5. With test keys set, the Razorpay tab appears. Without keys, or with `rzp_live_` keys, it does not, and live keys log a clear error.
6. A Razorpay payment confirms the order only after signature verification and a server-side fetch of the payment. A tampered signature is refused. A completion arriving from browser, reconcile and webhook confirms once.
7. A late Razorpay payment after hold expiry is refunded automatically and the order is not confirmed.
8. Cancelling a paid Razorpay order, and completing a return refund, create Razorpay refunds. A Razorpay failure leaves the refund "initiated" with Retry.
9. Razorpay unavailable: friendly message, and the demo payment still works.
10. Keyboard, screen reader, 360 px for the EMI UI.

## 18. Testing Strategy

- **Unit (shared):** EMI formula, rounding, no-cost discount, eligibility (bank, card type, minimums), offer stacking.
- **API:**
  - EMI quote and payment (normal, no-cost, refused combos);
  - order records the plan; refunds of no-cost EMI orders.
- **API with a fake Razorpay** (injected fetch, as the geo proxy does):
  - order creation;
  - verify (good and bad signature, amount mismatch, authorised → capture);
  - reconcile; webhook (raw-body signature, idempotent);
  - late payment refund;
  - refunds and retry;
  - live-key refusal.
- **Component:**
  - EMI plan list and summary;
  - product-page EMI line and dialog;
  - Razorpay tab with a stubbed `window.Razorpay` (success, failure, dismiss, script load failure).
- **E2E:**
  - demo EMI journey (no-cost plan → OTP → confirmation shows plan);
  - Razorpay with a stubbed `checkout.js` and API faked through a test-only Razorpay base URL.
- **Manual:** one real test-mode payment with your keys (card, UPI `success@razorpay`, EMI test card), and one refund. These are recorded in acceptance.

## 19. Dependencies

F-009 payment, F-010 refunds and lifecycle, F-013 option prices, Razorpay test account and keys (yours), ADR-005.

## 20. Out of Scope

- Live payments.
- Razorpay subscriptions or saved cards.
- Debit-card or cardless EMI in the demo payment.
- GST on EMI interest.
- Pre-approved EMI eligibility checks.
- Partial captures.
- Payouts and settlement reports.

## 21. Assumptions

- No-cost EMI is funded by the store as a discount (the usual Indian practice). In Razorpay mode it depends on an offer you configure in the Dashboard.
- Razorpay webhooks need a public URL; locally the app relies on browser verification plus reconcile.
- E2E cannot drive the real Razorpay Checkout reliably. A real test-mode payment is checked manually with your keys.

## 22. Decisions Required From User

Resolved 2026-10-06 (Gate 1): **D1** EMI terms as proposed; **D2** normal EMI may take the bank offer, no-cost EMI excludes it; **D3** refunds through Razorpay (test mode).

- **D1 — EMI terms:** banks, rates, tenures and minimums as in FR-1 (recommended), or different numbers.
- **D2 — Offer stacking:** normal EMI may take the bank offer; no-cost EMI excludes it (recommended). The alternative is that no offer combines with any EMI.
- **D3 — Razorpay refunds:** real test-mode refunds through Razorpay on cancel and return (recommended). The alternative is to record refunds in our app only.
