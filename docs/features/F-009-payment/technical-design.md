# Technical Design — F-009 Simulated payment

**Status:** Implementation
**Inputs:** specification.md (approved 2026-10-06), F-008 orders and holds, ADR-001, ADR-003 (JSON-only POST guard, simulated codes)

## 1. Shared (`packages/shared/src/payment.ts`)

The pure rules, used by the API (authority), the web preview and the test mocks:

- **Offers:**
  - `OFFERS`: the three fictional bank offers (FR-1).
  - `offerDiscountPaise(offer, amountPaise)`:
    - returns 0 below the minimum;
    - percent offers are floored to the whole rupee, then capped;
    - flat offers give their value.
  - `bestOfferFor(pricePaise)`: the product-page banner; `null` when no offer gives a saving.
  - `offerEligibility(offer, amountPaise, card)` returns `{ applies, discountPaise, shortfallPaise, reason? }`. The reason is one of:
    - `BELOW_MINIMUM`;
    - `NO_CARD`;
    - `WRONG_BANK`;
    - `WRONG_CARD_TYPE`.
- **Cards:**
  - `luhnValid(number)`;
  - `cardNetwork(prefix)`: Visa, Mastercard, RuPay, American Express, or `null`;
  - `CARD_RANGES`: fictional bank prefixes (6 digits) with network and card type;
  - `recogniseCard(bin)`: returns `{ network, bank, cardType }`, with `bank` and `cardType` set only for fictional ranges;
  - `cardOutcome(last4)`: `0002` → `declined`, `9995` → `insufficient_funds`, otherwise `success`;
  - `DEMO_CARDS`: one per fictional range, plus the two failure cards. All pass the Luhn check.
- **UPI:** `isUpiId(value)`, which accepts `name@handle`. The name is 2–256 characters from `[a-zA-Z0-9.\-_]`; the handle is 2–64 letters.
- **Rules:** `UPI_REQUEST_MS = 5 min` and `CARD_OTP_ATTEMPTS = 3`.
- **Types:**
  - `PaymentMethod` = `card` | `upi_id` | `upi_qr`;
  - `PaymentAttemptView`: id, orderId, method, status, failureReason, amountPaise, discountPaise, offerId, label, expiresAt, demoCode (card OTP, only while pending), qrUri (QR only);
  - `PaymentQuote`;
  - the payment summary added to `Order`.

`OrderStatus` gains `confirmed`. The two lifecycle steps are recorded in `Order.history`.

## 2. Data (additive; existing databases are upgraded in place)

```sql
payment_attempts(id TEXT PK, order_id FK CASCADE, method, status ('pending'|'succeeded'|'failed'),
  failure_reason NULL, amount_paise, discount_paise, offer_id NULL,
  card_network NULL, card_bank NULL, card_type NULL, card_last4 NULL, upi_id NULL,
  otp_hash NULL, otp_attempts, expires_at, created_at, completed_at NULL)
  -- partial unique index: one pending attempt per order
order_status_history(id PK, order_id FK CASCADE, status, at)
orders + payment_label, payment_method, offer_id, offer_discount_paise, paid_paise, paid_at  (ensureColumn)
```

No column can hold a full card number, an expiry or a CVV.

## 3. Payment service (`apps/api/src/payments/`)

The service takes the database, the cart service, the order service and the clock.

- **`quote(userId, orderId, { offerId?, bin? })`:** returns the amount, the eligibility of every offer, the selected offer's result, a suggested offer (one the card qualifies for that isn't the selected one) and the amount to pay.
- **`start(userId, orderId, input, visitorId)`:**
  1. Checks the order is the user's own, `pending_payment`, and not past its hold (sweeps first).
  2. Withdraws any pending attempt (`failed`, reason `cancelled`).
  3. Builds the attempt for the method:
     - **card:** validates the 6-digit prefix and the last 4 and recognises the card. A given `offerId` must apply, otherwise `409 OFFER_NOT_APPLICABLE`. It creates a 6-digit OTP, stores its hash and returns the code as `demoCode` (the ADR-003 pattern).
     - **upi_id:** validates the ID and sets `expiresAt = min(now + 5 min, holdExpiresAt)`.
     - **upi_qr:** sets `qrUri = demo-payment://pay?orderId=…&amount=<rupees>`.
  4. Records `payment_started`.
- **`verifyOtp(userId, attemptId, code)`:**
  - A wrong code adds an attempt. After 3, the attempt fails with `verification_failed`; otherwise it answers `401 INVALID_CODE { attemptsLeft }`.
  - A correct code applies `cardOutcome(last4)`. A success completes the payment; a failure fails with `declined` or `insufficient_funds`.
- **`respondUpi(userId, attemptId, approve)`:** approve completes the payment; decline fails with `upi_declined`.
- **`cancel(userId, attemptId)`:** fails the attempt with `cancelled`.
- **`get(userId, attemptId)`:** lazily expires the attempt first (see below).
- **Lazy expiry** runs before every read or action:
  - a pending attempt past `expiresAt` fails with `upi_expired` (UPI) or `hold_expired` (card);
  - a pending attempt whose order is no longer pending fails with `hold_expired`, or `cancelled` if the order was cancelled.
- **Idempotency:** any action on a `succeeded` attempt returns it unchanged. Any action on a `failed` attempt answers `409 ATTEMPT_NOT_PENDING` with the attempt.
- **`complete(attempt)`** is one transaction. It re-reads the order and refuses unless the order is `pending_payment` and `hold_expires_at > now`; then it:
  1. marks the attempt `succeeded`;
  2. writes the order's payment fields, sets status `confirmed`, and sets `hold_released_at = now` so the F-008 release can never run;
  3. converts the held stock into a sale (`on_hand -= q`, `reserved -= q`) for each line;
  4. inserts `payment_successful` and `confirmed` into the status history;
  5. decrements the matching cart lines by the ordered quantity, deleting any that reach 0;
  6. records `payment_completed` and `order_created`.

  Because the status check is inside the transaction, a double approval cannot complete twice.
- **Server-side events:**
  - inserted into `analytics_events`, using the client's `visitorId` from the request body (falling back to `user-<id>`);
  - recorded once, because they're tied to state changes.
- **Order cancel and the expiry sweep (F-008)** also fail any pending attempt, with `cancelled` or `hold_expired`.

## 4. API

| Endpoint | Behaviour |
|---|---|
| `GET /api/offers` | `{ offers }` |
| `GET /api/orders/:id/payment-quote?offerId=&bin=` | `quote` |
| `POST /api/orders/:id/payments` | `start` → `201 { attempt }` |
| `GET /api/payments/:id` | `{ attempt, order }` |
| `POST /api/payments/:id/verify` | `{ otp }` → `{ attempt, order }` |
| `POST /api/payments/:id/upi-response` | `{ approve }` → `{ attempt, order }` |
| `POST /api/payments/:id/cancel` | `{ attempt }` |

- Every route requires sign-in and checks that the attempt's order is the user's own. An unknown or foreign attempt answers 404.
- The card body is validated with zod. Unknown keys are rejected, so a request carrying a `cardNumber`, `cvv` or `expiry` is refused (`400`); the server never parses them.

## 5. Web

### Payment page (`features/payment/`; `PaymentPage` moves here from checkout)

- **Layout:**
  - the header, the hold countdown and a "Demo payment — no money is charged" notice;
  - `PaymentMethodTabs` (Radix Tabs);
  - the summary with a Bank offer line and Amount to pay;
  - the sticky Pay bar on mobile.
- **`CardPayment`:**
  - an offer radio group (none preselected, plus No offer; disabled options show "Add ₹X more");
  - `CardFields`:
    - number, expiry and CVV;
    - formatting, with the Luhn check and expiry/CVV validation done locally;
    - `autocomplete` `cc-number`, `cc-exp` and `cc-csc`;
  - `DemoCardList`;
  - the quote is fetched with `offerId` and the first 6 digits once 6 digits are entered;
  - the mismatch reason and the Apply hint;
  - **Pay ₹X** sends only `{ method, bin, last4, offerId, visitorId }`;
  - `BankVerification`, shown inline in place of the form:
    - OTP entry with the demo code shown;
    - Verify;
    - Cancel;
    - attempts left.
- **`UpiPayment`:**
  - UPI ID or QR (radio);
  - `UpiPending`: a timer, Open demo UPI app or Simulate scan, and Cancel request;
  - `DemoUpiApp`: a Dialog styled as a phone, with Approve and Decline;
  - the attempt is polled every 2 seconds while pending.
  - The QR is rendered with the `qrcode` package as an image with descriptive alt text.
- **`PaymentFailure`:** an alert with a plain reason and Try again. The tab and method stay selected.
- **Outcomes:**
  - success navigates to `/orders/:id/confirmation`, replacing the history entry, and invalidates the cart;
  - an order in `confirmed` on the payment page redirects to the confirmation;
  - the expired and cancelled states are kept from F-008.

### Confirmation page (`features/orders/ConfirmationPage.tsx`)

- Route: `/orders/:orderId/confirmation`.
- Shows the order number, paid amount and method label, savings (product discount plus offer), address and estimate, and items.
- The primary action is Continue shopping.

### Product page

- `OfferBanner` sits under the price and uses `bestOfferFor(price)` from the shared rules.
- **All offers** opens an `OffersPanel` (Sheet).
- The banner is hidden when the product is out of stock or no offer applies.

### Mocks

`test/paymentServer.ts` holds MSW handlers built on the shared rules.

## 6. Spec clarifications

None that change behaviour. The product-page banner uses the shared rules directly rather than calling `/api/offers`; both read the same constant.
