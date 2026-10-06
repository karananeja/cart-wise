# Feature Intent

**Feature:** F-009 — Simulated payment (card, UPI, card offers)
**Status:** Approved (Gate 1, 2026-10-06)
**Approved by / date:** User, 2026-10-06

---

## 1. In one sentence

The customer pays for their held order by card (any valid number, simulated) or demo UPI, can choose a bank offer for their card, and lands on a clear "Order confirmed" page. A failed payment loses nothing and can be retried while the hold lasts.

## 2. Intended behavior

- **Product page:** a quiet line under the price shows the best real saving, for example "Save ₹600 with Aurora Bank credit cards". **All offers** shows the terms of all three fictional bank offers. If no offer applies at that price, the line is hidden.
- **Payment page:**
  - The F-008 countdown and summary stay.
  - Two tabs: **Card** and **UPI**.
  - Everything is labelled "Demo payment — no money is charged".
- **Card:**
  - Choose a bank offer (or none), then type any valid card number, or pick one from the demo list.
  - The network and fictional bank are recognised as you type.
  - If the chosen offer matches your card, the button shows the reduced amount: **Pay ₹5,400**. If it doesn't, you're told why.
  - If your card qualifies for an offer you didn't choose, a hint offers to apply it.
  - Only the first 6 and last 4 digits are sent; the full number, CVV and expiry stay in the browser.
  - A demo bank OTP step follows; the code is shown on screen.
  - Cards ending 0002 are declined and 9995 fail for insufficient funds; all others succeed.
- **UPI:**
  - Enter a UPI ID and send a request, or show a QR code (`demo-payment://…`).
  - **Open demo UPI app** or **Simulate scan** opens a phone-style screen with **Approve** and **Decline**.
  - Requests expire after 5 minutes.
- **If it fails:**
  - a plain reason and **Try again**;
  - the order and hold continue, the cart is untouched, and you can switch method.
- **If it succeeds:**
  - the order is confirmed;
  - the held stock becomes a sale;
  - the purchased items leave your cart;
  - you see the order number, the amount paid, the masked method ("Aurora Bank Visa •••• 4242"), what you saved, and when it arrives.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| One offer per order, chosen by the customer (with an Apply hint) | Your decision; the hint stops a customer missing a saving they qualify for |
| Banner only when a real saving exists | Honest; no fake urgency (CLAUDE.md §13) |
| Any valid card number; only the first 6 and last 4 digits sent | Your decision; keeping the full number in the browser means no real card data reaches the server (PAY-4) |
| Demo bank OTP and demo UPI app | Familiar Indian payment rhythm, and the failure paths can be shown |
| Pay button shows the exact amount | No surprises at the last click |
| Hold not extended by retries | Keeps the F-008 promise simple: 10 minutes, shown on screen |
| Items removed from cart only on success | Brief §13: failure must not lose the cart |

## 4. What this feature deliberately does not do

- Saved cards
- EMI
- Net banking
- Wallets
- Cash on delivery
- Coupons
- UPI offers
- Refunds
- Order history and tracking (F-010)
- Email/SMS receipts

## 5. How we will know it works

Acceptance criteria 1–13 in `specification.md` §17.

## 6. Decisions needed before implementation

Resolved 2026-10-06 (`specification.md` §22):
- the customer chooses the offer;
- any valid card number is accepted;
- the bank OTP step is included;
- UPI uses an in-page demo app, with no PIN.

## 7. Approval

- [x] Approved for implementation (Gate 1) — 2026-10-06
