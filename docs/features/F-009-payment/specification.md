# Feature Specification

## Feature

**ID:** F-009
**Name:** Simulated payment — card, UPI and card offers
**Status:** Draft — decisions recorded, awaiting Gate 1 approval
**Requirements:** PAY-1, PAY-2, PAY-3, PAY-4, PAY-5, PAY-6, ORD-1, CHK-1 (Payment → Confirmation), NFR-5, NFR-8, STATE-1, ANL-1 (`payment_started`, `payment_failed`, `payment_completed`, `order_created`)

**User decisions already applied:**
- **Q17 (2026-10-06):** card offers use fictional banks. The offer rules, the product-page banner and the discount at payment are built together here.
- **Q10 (2026-10-06):** stock is held for 10 minutes from Continue to payment (F-008). Payment happens inside that hold.

**User decisions (2026-10-06, Gate 1 questions):**
- **Offers:** the customer chooses the offer at payment (one per order). It is not applied automatically.
- **Cards:** any card number that passes the Luhn check is accepted, and the outcome follows a rule. Real numbers can therefore be typed, so the full number never leaves the browser (FR-12).
- **Bank OTP:** card payments include a simulated bank OTP step.
- **UPI:** an in-page demo UPI app dialog with Approve/Decline, a 5-minute request window, and no UPI PIN.

---

## 1. Objective

Turn the held, Pending Payment order from F-008 into a confirmed order. The customer pays by card or UPI, sees any bank offer before paying, and gets a clear confirmation. No real money moves, and no real card data is ever accepted or stored.

## 2. User Problem

Payment is the most anxious step:
- "Will I get the bank discount?"
- "Did it go through?"
- "If it fails, do I lose everything?"

Shoppers also decide where to buy based on bank offers, so they want to see them on the product page, not just at the last step.

## 3. User Intent

"Pay the way I usually do, get my card's discount, and know for certain whether it worked."

## 4. User Stories

- As a shopper on a product page, I want to see the best card offer for this product, so I know what I'll actually pay.
- As a customer paying, I want to choose my card's bank offer, see whether it applies, and see the final amount on the Pay button.
- As a customer, I want to pay by UPI, by entering my UPI ID or by scanning a QR code.
- As a customer whose payment failed, I want to know why and try again, without losing my cart or my held items.
- As a customer whose payment succeeded, I want a confirmation with my order number, what I paid and when it arrives.

## 5. Functional Requirements

### 5.1 Card offers (PAY-5)

- FR-1 **Offer catalogue.** Offers are fixed application data. Every bank is fictional and every offer is labelled as a demo offer:

  | Offer | Cards | Benefit | Minimum order | Maximum discount |
  |---|---|---|---|---|
  | Aurora Bank | Credit cards | 10% instant discount | ₹5,000 | ₹1,500 |
  | Meridian Bank | Credit and debit cards | Flat ₹250 off | ₹2,500 | ₹250 |
  | Kestrel Bank | Credit cards | 5% instant discount | ₹1,000 | ₹750 |

- FR-2 **One offer per order, chosen by the customer.**
  - At most one offer applies.
  - The customer selects it on the payment page from the offers list (radio options plus **No offer**); none is preselected.
  - A selected offer applies only when the card entered matches its bank and card type, and the order total (after delivery) meets the minimum.
  - If the selected offer doesn't match the card, the page says why ("This offer needs an Aurora Bank credit card") and the Pay button shows the full amount.
  - If the card entered qualifies for an offer that isn't selected, a hint offers it: "Your card qualifies for the Aurora Bank offer (−₹600) — Apply". The customer still makes the choice; nothing is applied silently.
- FR-3 **Discount rules.**
  - The discount is computed by the server: percentage of the order total, rounded down to the rupee, capped at the maximum.
  - The amount to pay is the order total minus the discount.
  - The discount is fixed when payment succeeds and recorded on the order.
- FR-4 **Product-page banner.**
  - Below the price, the product page shows the single best offer for one unit at the current price, for example "Save ₹600 with Aurora Bank credit cards".
  - "Best" means the offer giving the largest discount on that price.
  - **All offers** opens a panel listing every offer with its terms, and notes that the offer is applied at payment on the full order.
  - If no offer applies at that price, the banner is not shown; there is no invented saving.
  - Out-of-stock products don't show it.
- FR-5 **Payment page offers.**
  - Offers are shown on the Card tab as the selectable list from FR-2, each with its saving on this order, for example "Save ₹600".
  - Offers the order doesn't reach are shown disabled, with "Add ₹1,200 more to qualify". These hints are informational only; they don't link back to the cart.
  - With a selected offer and a matching card, the summary shows "Aurora Bank offer: −₹600" and the Pay button shows the reduced amount.

### 5.2 Payment page (replaces the F-008 interim page)

- FR-6 `/checkout/pay/:orderId` keeps:
  - the order number;
  - the hold countdown;
  - the order summary;
  - the delivery details;
  - **Cancel and return to cart**.

  It adds a choice of **Card** and **UPI** as two tabs. Card is selected first.
- FR-7 The summary gains a **Bank offer** line, shown when an offer applies, and **Amount to pay**.
- FR-8 Every payment detail is visibly labelled as a demo, for example "Demo payment — no money is charged".

### 5.3 Card payment (PAY-1, PAY-2, PAY-4)

- FR-9 **Fields:** card number, expiry (MM/YY) and CVV, with standard formatting and validation:
  - Luhn check on the number;
  - expiry not in the past;
  - CVV of 3 digits.

  - Validation also covers the expiry (not in the past) and the CVV (3 digits, or 4 for American Express).
  - As the number is typed, the network is recognised from its prefix (Visa, Mastercard, RuPay, American Express).
  - If the number falls in one of the fictional banks' card ranges, the bank and card type are also shown, for example "Aurora Bank · Visa credit".
- FR-10 **Any valid card number is accepted; the outcome follows a rule.**
  - Any number that passes the Luhn check can be used.
  - The outcome depends on the last 4 digits:

    | Last 4 digits | Outcome |
    |---|---|
    | `0002` | Declined by the bank |
    | `9995` | Fails: insufficient funds |
    | anything else | Succeeds (after the bank OTP) |

  - Cards from the fictional banks are recognised by fictional card-number prefixes, and only these can receive an offer. Other cards pay the full amount.
  - A **Use a demo card** list fills in one card for each bank plus the two failure cards. The rule is explained next to it.
- FR-11 **Bank verification step.**
  - After **Pay ₹X**, a "Demo bank verification" step asks for a 6-digit OTP. The code is shown on screen, as in F-006's simulated OTP.
  - A correct code completes the payment.
  - Three wrong codes fail the attempt ("Verification failed").
  - **Cancel** on this step returns to the payment choice, and that attempt counts as failed.
  - Cards with a failure outcome fail at this step, after the OTP is entered, with their reason.
- FR-12 **The full card number never leaves the browser.** Because any valid number is accepted, someone could type a real card number, so:
  - the browser sends only the first 6 digits (enough to recognise the network and fictional bank) and the last 4;
  - the CVV and expiry are checked in the browser and never sent;
  - the server stores only the network, the fictional bank and card type (if any), and the last 4 digits;
  - the form uses `autocomplete="cc-number"` etc. for usability, but nothing is saved by the app;
  - nothing card-related is logged.
  - Saved cards are out of scope.

### 5.4 UPI payment (PAY-1, PAY-6)

- FR-13 The UPI tab offers two ways:
  - **Pay by UPI ID** (the default);
  - **Scan QR code**.
- FR-14 **UPI ID.**
  - The customer enters an ID in the form `name@handle`, which is format-checked, and presses **Send payment request**.
  - The page shows "Approve the request in your UPI app", with a 5-minute request timer, and checks for the result.
  - **Open demo UPI app** opens a phone-style screen showing the payee (the store), the amount and the order number, with **Approve** and **Decline**.
- FR-15 **QR code.**
  - The page shows a QR code encoding `demo-payment://pay?orderId=ORD-…&amount=…` (brief §13).
  - It shows the amount and the same 5-minute timer.
  - **Simulate scan** opens the same demo UPI app screen.
- FR-16 **UPI outcomes:**
  - **Approve** succeeds.
  - **Decline** fails with "You declined the request".
  - No response within 5 minutes fails with "The request expired". The request is also cut short if the stock hold ends first.
  - **Cancel request** on the payment page withdraws it.
- FR-17 Card offers don't apply to UPI. The UPI tab says so when an offer would have applied to a card.

### 5.5 Failure and retry (PAY-2, PAY-3)

- FR-18 **When a payment fails:**
  - the order stays Pending Payment;
  - the hold and countdown continue (they are not extended);
  - the cart is untouched.

  The page shows the reason in plain words with **Try again**, keeping the chosen method selected. The customer may also switch method.
- FR-19 Retries are unlimited within the hold. Only one attempt can be in progress per order: starting a new one withdraws any open UPI request.
- FR-20 **If the hold expires during an attempt:**
  - the attempt cannot succeed;
  - a late approval is refused;
  - the page shows the existing "Your hold expired — your cart is still here" state. Nothing was charged.

### 5.6 Success and confirmation (ORD-1)

- FR-21 **Success is one transaction.** It happens only if the order is still Pending Payment and its hold hasn't expired. It:
  - records the payment: method, masked label (for example "Aurora Bank Visa •••• 4242" or "UPI · karan@okdemo"), offer, discount, amount paid and time;
  - moves the order through **Payment Successful → Order Confirmed**, recording both steps with times for F-010's timeline;
  - converts the held stock into a sale: `on_hand` and `reserved` both decrease by the quantity, so availability is unchanged;
  - removes the ordered quantities from the customer's cart. Anything added to the cart since checkout stays.
- FR-22 **Idempotency.** A payment can complete only once. Repeating the request or approving twice returns the same result, and never charges twice or reduces stock twice.
- FR-23 **Confirmation page** (`/orders/:orderId/confirmation`) shows:
  - "Order confirmed" and the order number;
  - the amount paid and how (masked);
  - savings: product discount plus bank offer;
  - the delivery address and estimated arrival;
  - the items.

  The primary action is **Continue shopping**. The page is reloadable, and only the owner can see it. Order history and order details pages arrive in F-010.
- FR-24 Visiting the payment page of an already paid order redirects to its confirmation.

### 5.7 Analytics (ANL-1)

| Event | When | Properties |
|---|---|---|
| `payment_started` | An attempt begins (Pay pressed, UPI request sent, or QR shown) | method (`card` / `upi_id` / `upi_qr`), amountPaise, offerId? |
| `payment_failed` | An attempt fails | method, reason (`declined`, `insufficient_funds`, `verification_failed`, `upi_declined`, `upi_expired`, `cancelled`, `hold_expired`) |
| `payment_completed` | Payment succeeds | method, amountPaise, discountPaise, offerId? |
| `order_created` | The order is confirmed | itemCount, totalPaise |

These events are recorded by the server, at the state change, so they're counted once.

## 6. Non-Functional Requirements

- **Safety (NFR-5):** the full card number, CVV and expiry never reach the server (FR-12). Amounts, offer eligibility and outcomes are decided by the server; the client's displayed amount is never trusted.
- **Integrity:**
  - success, stock conversion and cart update happen atomically;
  - completion happens exactly once;
  - an expired or cancelled order can never be paid.
- **Honesty (NFR-8):** every bank, card, UPI app and offer is labelled as a demo. Banners show only real, computed savings.
- **Accessibility:**
  - tabs and radio groups are keyboard-operable;
  - card fields have proper `autocomplete`/`inputmode`;
  - errors are linked to fields;
  - payment results and UPI status are announced;
  - the demo UPI app is a labelled dialog with focus trapped.
- **Responsiveness:** works at 360 px. The amount to pay and the Pay button are in the sticky bottom bar on mobile.

## 7. UX Requirements

- One primary action at a time: **Pay ₹X** → **Verify** → confirmation.
- No surprises:
  - the Pay button always shows the exact amount;
  - the offer is visible before paying;
  - the hold countdown stays visible.
- Failure is calm and recoverable: plain reason, Try again, nothing lost.
- Product page: a single, quiet offer line, with the details one tap away (progressive disclosure).

## 8. UI Requirements

- **Screens:** Product page (offer banner and All offers panel), Payment page, Demo bank verification step, Demo UPI app dialog, Confirmation page.
- **Components:** OfferBanner, OffersPanel, PaymentMethodTabs, CardForm, DemoCardList, BankVerification, UpiIdForm, UpiQr, UpiPendingStatus, DemoUpiApp, PaymentResult, ConfirmationPage.
- **States:**
  - payment: idle, validating, processing, verifying, awaiting UPI approval, failed (with reason), succeeded (redirect), hold expired, cancelled, offline;
  - confirmation: loading, not found.

## 9. Data Requirements

| Entity | Fields | Notes |
|---|---|---|
| Offer (static, in `@store/shared`) | id, bank, cardTypes, kind (percent/flat), value, minOrderPaise, maxDiscountPaise | Fictional |
| Card range (static, shared) | prefix, bank, network, cardType | Fictional bank card-number prefixes; the outcome rule is keyed on the last 4 digits |
| Demo card list (static, web) | number, label | For convenience only; any valid number works |
| PaymentAttempt | id, orderId, method, status (`pending` / `succeeded` / `failed`), failureReason, cardBank, cardNetwork, cardType, cardLast4, upiId, offerId, discountPaise, amountPaise, otpHash, otpAttempts, expiresAt, createdAt, completedAt | One `pending` per order at a time |
| Order | + paymentLabel, offerDiscountPaise, paidPaise, paidAt; status gains `confirmed` | |
| OrderStatusHistory | orderId, status, at | Records Payment Successful and Order Confirmed now; F-010 extends |

## 10. API Requirements

All routes require sign-in and order ownership.

| Endpoint | Purpose |
|---|---|
| `GET /api/offers` | Offer catalogue (also used by the product page) |
| `GET /api/orders/:id/payment-quote?offerId=&bin=` | Amount to pay, whether the selected offer applies to that card (with the reason if not), the eligibility list, and a suggested offer for the card |
| `POST /api/orders/:id/payments` | `{ method: 'card', bin, last4, offerId? }` → attempt with OTP challenge; `{ method: 'upi_id', upiId }` or `{ method: 'upi_qr' }` → pending attempt (QR URI included) |
| `POST /api/payments/:attemptId/verify` | `{ otp }` → success, failure, or remaining tries |
| `POST /api/payments/:attemptId/upi-response` | `{ approve: boolean }`, from the demo UPI app |
| `POST /api/payments/:attemptId/cancel` | Withdraw an attempt |
| `GET /api/payments/:attemptId` | Status, for UPI polling |
| `GET /api/orders/:id` | Gains payment and confirmation fields |

**Errors** (409 unless noted):
- `ORDER_NOT_PENDING`;
- `HOLD_EXPIRED`;
- `INVALID_CARD` (400);
- `OFFER_NOT_APPLICABLE` (409, with the reason);
- `INVALID_UPI_ID` (400);
- `ATTEMPT_NOT_PENDING`.

## 11. State Management

- **Server state:**
  - the order query;
  - the payment quote, keyed by the selected offer and the card's first 6 digits;
  - the attempt query, polled every 2 seconds while a UPI request is pending.
- **Local state:**
  - the selected tab;
  - form fields (the full number, CVV and expiry stay local, never sent);
  - the selected offer.

## 12. Loading States

- Pay and Send payment request show a spinner and are disabled while processing.
- UPI pending shows a waiting state with its timer.
- The confirmation page has a skeleton.

## 13. Empty States

N/A. The payment page always has an order; if no offer applies, the offers list still shows the terms.

## 14. Error States

- Payment failures: FR-18.
- Hold expired, cancelled, or not found: as in F-008.
- Network error during Pay: "We couldn't reach the payment service — you have not been charged", with Try again. Idempotency makes the retry safe.
- Offline: payment actions are disabled, with a notice.

## 15. Security Considerations

- Only the first 6 and last 4 digits are sent; the full number, CVV and expiry never leave the browser; only masked data is stored (FR-12).
- The server trusts the first 6 and last 4 sent by the client. That is acceptable only because payment is simulated; a real gateway would tokenise the card instead.
- OTPs are stored hashed, limited to 3 tries, and valid only for the attempt.
- Ownership is checked on every order and attempt route. The demo UPI approval route also checks the order owner, so one customer can't approve another's payment.
- JSON-only POST guard from ADR-003 applies.

## 16. Analytics

See §5.7.

## 17. Acceptance Criteria

1. A product priced ₹6,000 shows "Save ₹600 with Aurora Bank credit cards". A product priced ₹800 shows no banner. All offers lists all three offers with terms, marked as demo offers.
2. On a ₹6,000 order:
   - no offer is preselected;
   - selecting the Aurora offer and entering an Aurora card shows "Aurora Bank offer: −₹600", and the button reads "Pay ₹5,400";
   - with a non-Aurora card, the page explains why the offer doesn't apply, and the button shows the full amount;
   - entering an Aurora card with no offer selected shows the Apply hint.

   Offers above the order's amount are disabled, with "Add ₹X more".
3. Only one offer ever applies. The server checks eligibility and computes the discount; tampering with the amount or forcing an ineligible offer is refused.
4. Any Luhn-valid number is accepted; invalid numbers are refused in the browser. Network requests and the database contain no full card number, expiry or CVV — only the first 6 and last 4 digits are sent, and only the last 4 are stored.
5. A succeeding card plus the correct OTP:
   - confirms the order (Payment Successful → Order Confirmed, both timestamped);
   - converts the held stock into a sale (availability unchanged, `on_hand` reduced);
   - removes the ordered items from the cart;
   - shows the confirmation page with masked card and savings.
6. Cards ending `0002` (declined) and `9995` (insufficient funds) fail with their reason. Three wrong OTPs fail as "Verification failed". In each case the order stays pending, the countdown continues, the cart is intact, and Try again works.
7. UPI ID: Send request → demo UPI app → Approve confirms the order. Decline fails with the reason. No response for 5 minutes expires the request. Cancel request withdraws it.
8. UPI QR: the QR encodes `demo-payment://pay?orderId=…&amount=…`; Simulate scan → Approve confirms the order.
9. Payment cannot succeed after the hold expires, including a late UPI approval; the page shows the hold-expired state.
10. Double-submitting Pay or approving twice confirms the order once and reduces stock once.
11. Another customer can't view, pay, or approve the order's payments.
12. `payment_started`, `payment_failed` (with reason), `payment_completed` and `order_created` are each recorded once per occurrence.
13. Keyboard and screen reader can complete card and UPI payments. Works at 360 px with a sticky Pay bar.

## 18. Testing Strategy

- **Unit:**
  - offer selection and discount maths (percent rounding, cap, minimum, best offer for a price);
  - Luhn check, network and fictional-bank recognition, outcome rule;
  - offer eligibility for a card and a chosen offer;
  - UPI ID format.
- **API:**
  - each card outcome;
  - OTP tries;
  - UPI approve, decline, expiry and cancel;
  - one pending attempt;
  - idempotent completion;
  - payment after hold expiry refused;
  - stock conversion and cart update;
  - ownership;
  - analytics recorded once.
- **Component:**
  - offer banner and panel;
  - card form (recognition, demo list, only the first 6 and last 4 digits sent, Pay amount);
  - offer selection, mismatch message and Apply hint;
  - bank verification;
  - UPI flows with polling;
  - failure and retry;
  - confirmation page.
- **E2E:**
  - product banner → checkout → choose offer → card success → confirmation → cart reduced;
  - decline then retry with another card;
  - UPI ID approve;
  - another shopper's view (stock reduced only once);
  - mobile.

## 19. Dependencies

F-008 (orders, holds, payment page). F-010 adds order history, order details and the lifecycle after Order Confirmed, and links from the confirmation page. F-011 drives the later statuses.

## 20. Out of Scope

- Saved cards
- EMI
- Net banking
- Wallets
- Cash on delivery
- Coupons
- UPI offers
- Partial payments
- Refunds (F-010)
- Real gateways
- Email/SMS receipts
- Confirmation page links to order history (F-010)

## 21. Assumptions

- **Offer basis:** offers are measured on the order total including delivery, because that's the amount charged.
- **Banner basis:** the product-page banner uses one unit at the current price. The panel explains that the final offer depends on the order total.
- **No extra payment hold time:** the 10-minute hold from F-008 is not extended by payment attempts.
- **Lifecycle steps:** Payment Successful and Order Confirmed happen together, since there's no manual merchant acceptance in the MVP.

## 22. Decisions Required From User

Resolved 2026-10-06:
- the customer chooses the offer, one per order;
- any Luhn-valid card number is accepted, with the outcome set by its last 4 digits;
- the bank OTP step is included;
- UPI uses an in-page demo app with a 5-minute window and no PIN.
