# Technical Design — F-014 EMI and Razorpay (test mode)

**Status:** Implementation
**Inputs:** specification.md (approved 2026-10-06, FR-3 example corrected), ADR-005, F-009 payments, F-010 lifecycle

## 1. Shared

### `packages/shared/src/emi.ts`

- **Constants:**
  - `EMI_RATES` (aurora 14, meridian 15, kestrel 16);
  - `EMI_TENURES` [3, 6, 9, 12] and `NO_COST_TENURES` [3, 6];
  - `EMI_MIN_PAISE` ₹3,000 and `NO_COST_MIN_PAISE` ₹10,000.
- **`emiFactor(rate, n)`:** k = r(1+r)ⁿ / ((1+r)ⁿ − 1), with r = rate / 1200.
- **`emiPlan(bank, amount, n, noCost)`:** returns `{ tenure, ratePercent, noCost, chargedPaise, discountPaise, monthlyPaise, interestPaise, totalPaise }`. Amounts are rounded to the rupee.
  - **Normal:** charged = amount; monthly = amount·k; total = monthly·n; interest = total − amount.
  - **No-cost:**
    - charged = amount / (n·k), discount = amount − charged;
    - monthly = amount / n; total = amount; interest to the customer 0.
- **`emiEligibility(card, orderTotal)`:** returns a reason: `NO_CARD`, `NOT_CREDIT`, `BANK_NOT_SUPPORTED` or `BELOW_MINIMUM`.
- **`emiPlansFor(card, orderTotal, offerDiscount)`:**
  - normal plans on (total − offer);
  - no-cost plans on the full total (D2: no offer with no-cost).
- **`lowestEmi(price)`:** for the product page — `{ monthlyPaise, noCostAvailable }`, or null below the minimum.

### `payment.ts`

- **Methods and reasons:**
  - `PaymentMethod` adds `razorpay`.
  - `PaymentFailureReason` adds `gateway_failed` and `gateway_unverified`.
- **Inputs and views:**
  - Card input adds `emi?: { tenure, noCost }`.
  - `PaymentQuote` adds `emi`.
  - `PaymentAttemptView` adds `emi` and `gateway?: { keyId, orderId, amountPaise, prefill }`.
- **`OrderPayment`:** adds `provider` and `emi: { tenure, monthlyPaise, noCost, interestPaise } | null`.
- **`NO_COST_EMI_OFFER_ID`:** the no-cost discount is stored as the order's offer.

## 2. Data (in-place upgrades)

- **`payment_attempts`:**
  - It is rebuilt once to widen the `method` check. The rebuild runs in a transaction: drop the indexes, rename the old table, re-run the schema, copy the common columns, then drop the old table.
  - New columns: `emi_tenure`, `emi_rate_bp`, `emi_monthly_paise`, `emi_interest_paise`, `emi_no_cost`, `gateway_order_id`, `gateway_payment_id`.
- **`orders`:** adds `payment_provider`, `emi_tenure`, `emi_monthly_paise`, `emi_interest_paise`, `emi_no_cost` and `gateway_payment_id`.
- **`refunds`:** adds `gateway_refund_id` and `failure`.

## 3. Razorpay client (`apps/api/src/payments/razorpay.ts`)

- **`loadRazorpayConfig(env)`:**
  - returns `{ enabled: false }` without keys;
  - returns `{ enabled: false, error }` for `rzp_live_` keys or a key id/secret mismatch;
  - a base URL override is accepted only for localhost (the E2E fake).
- **`createRazorpayClient(config, fetch)`:**
  - `createOrder`, `fetchPayment`, `orderPayments`, `capture`, `refund` (with our refund id as `receipt`), `refundsOf`;
  - Basic auth; 10 s timeout; every failure becomes `GatewayError`.
- **`verifyPaymentSignature` and `verifyWebhookSignature`:** HMAC-SHA256 compared with `timingSafeEqual`.

## 4. API

### Payments service

- **EMI on card starts:**
  - checks eligibility, tenure, and no-cost + offer (`OFFER_NOT_APPLICABLE`);
  - stores the plan on the attempt; the no-cost discount goes in `discount_paise` with `offer_id = no-cost-emi`.
- **`complete(attemptId, settlement?)`:** gains an optional settlement for Razorpay: paid amount, discount, label and gateway payment id. The order also records the provider and the EMI plan.
- **Razorpay:**
  - **`startRazorpay`** is async. It creates a Razorpay order for the total, with receipt = our order id, notes and the optional no-cost offer id. It then inserts the attempt with the prefill details (name, email, mobile).
  - **`verifyRazorpay(attemptId, ids)`:**
    1. checks the signature (`gateway_unverified` → 400);
    2. `finalize(paymentEntity)`: the payment must belong to our Razorpay order, its amount must be ≤ the total (less only when Razorpay applied an offer) and its status authorised or captured; capture it if needed;
    3. `complete`; if the hold has expired, refund the captured payment.
  - **`reconcile(row)`:** throttled to once every 15 s per attempt. It lists the Razorpay order's payments and finalizes a paid one. It runs on `GET /payments/:id` and before `cancel`.
  - **Webhook:** `payment.authorized` and `payment.captured` → `finalize`. The raw body is captured by `express.json({ verify })`. Without a webhook secret the route answers 404.
- **Routes:**
  - `GET /payments/config`;
  - `POST /payments/:id/razorpay/verify`;
  - `POST /payments/razorpay/webhook`.
- **Change from the spec:** there is no `/razorpay/failed` endpoint. Razorpay Checkout lets the customer retry inside its own window, and closing the window cancels the attempt (after a reconcile).

### Lifecycle refunds (D3)

- Razorpay orders get their refund rows created as `initiated`. After the transaction, `gatewayRefunds.process(refundId)` calls Razorpay.
  - On success the refund is marked `refunded` with `gateway_refund_id`.
  - On failure it stores the failure note and stays `initiated`.
- **Return refunds:** the operator's "Refund" calls Razorpay first and moves the return to `refunded` only on success. It answers 502 `GATEWAY_UNAVAILABLE` otherwise.
- **Retry:** `POST /sim/refunds/:id/retry`.
- **Double refunds** are prevented by checking `refundsOf(payment)` for our receipt before creating a refund.

### Configuration

- `apps/api/.env` is loaded through `tsx --env-file-if-exists=.env`; `.env.example` documents the settings.
- `server.ts` logs whether Razorpay is enabled, or why it is refused. The secret is never logged.

## 5. Web

- **`features/payment/EmiBanner.tsx`:** on the product page under the offer banner: "EMI from ₹X/month · No Cost EMI available" and a "View plans" dialog (banks × tenures), using the shared functions.
- **`CardPayment`:** once an eligible credit card is recognised:
  - a "Pay in full / Pay in EMI" radio;
  - an `EmiPlans` radio list (tenure, monthly, interest, total, No Cost tag);
  - choosing a no-cost plan clears the bank offer (with a note).
- **`RazorpayPayment.tsx`:**
  - The tab appears when `/payments/config` reports Razorpay enabled.
  - It lazy-loads `checkout.js` and starts an attempt.
  - Checkout opens with `key`, `order_id`, `amount` and `prefill`. `handler` → verify; `ondismiss` → cancel.
  - States: loading the script, opening, confirming, failed, unavailable.
- **Order views:** confirmation, order page and summary show the EMI plan and the No Cost discount. The console shows Razorpay refund status and Retry.

## 6. Tests

See `test-plan.md`. Razorpay is faked in three places:
- an in-process fake `fetch` (API tests);
- a stubbed `window.Razorpay` (component tests);
- a small fake Razorpay HTTP server plus a stubbed `checkout.js` (E2E).
