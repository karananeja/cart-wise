# Test Plan

**Feature:** F-009 — Simulated payment (card, UPI, card offers)

## 1. Scope

**Tested:**
- offer rules;
- card recognition and outcomes;
- the card OTP;
- UPI ID and QR flows;
- failure and retry;
- completion: confirmed status, stock converted to a sale, cart reduced, history and events recorded;
- idempotency;
- hold expiry;
- ownership;
- no card data reaching the server;
- product banner and offers panel;
- confirmation page;
- mobile.

**Not tested:** real gateways (none exist) and visual polish of the demo UPI phone frame (manual).

## 2. Risk areas

- **Double completion:** stock reduced twice, or the order confirmed twice.
- **Hold boundaries:** payment completing after the hold expires, or a late UPI approval.
- **Offer maths:** rupee rounding, the cap, the minimum, eligibility by bank and card type, and a client forcing an ineligible offer.
- **Card data:** the full number, CVV or expiry sent or stored.
- **Cart reduction:** reducing only the ordered quantities, and keeping lines added after checkout.
- **Ownership:** one customer approving another's UPI request.

## 3. Tests

| Level | Area | Cases | File |
|---|---|---|---|
| Unit | Offers | Percent floor and cap, flat, minimum, best offer for a price (₹6,000 → Aurora ₹600; ₹3,000 → Meridian ₹250; ₹800 → none), eligibility reasons | `packages/shared/src/payment.test.ts` |
| Unit | Cards | Luhn check; networks; fictional ranges; outcome by last 4; demo cards valid; UPI ID format | same |
| API | Card | Success after OTP → confirmed, stock converted, cart reduced, history; decline; insufficient funds; 3 wrong OTPs; ineligible offer refused; offer applied amount; unknown keys (`cardNumber`) refused | `apps/api/src/payments/payments.test.ts` |
| API | UPI | ID approve; decline; 5-minute expiry; cancel; QR URI; new attempt withdraws the old one | same |
| API | Boundaries | Hold expiry blocks payment (including late approval); double verify or approve completes once; order cancel fails the pending attempt; ownership (404); events recorded once | same |
| Component | Product page | Banner shows the best saving and is hidden below the minimum or when out of stock; offers panel | `features/payment/Offers.test.tsx` |
| Component | Payment | Offer selection, mismatch reason, Apply hint, Pay amount; request body has only the first 6 and last 4 digits; OTP step; failure and Try again; UPI pending, polling, demo app approve; expired state; confirmed redirect | `features/payment/Payment.test.tsx` |
| Component | Confirmation | Paid label, savings, items; not found | same |
| E2E | Journey | Product banner → checkout → Aurora offer + card → OTP → confirmation → cart reduced → another shopper's stock reduced once; decline then retry; UPI ID approve; mobile sticky Pay | `e2e/payment.spec.ts` |

## 4. Manual verification

- Demo UPI dialog and QR legibility in light and dark themes.
- Screen-reader announcements for the payment result and UPI status.
- 360 px layout of the payment page and the demo app.

## 5. Results

| Run date | Command | Result | Notes |
|---|---|---|---|
