# Feature Intent

**Feature:** F-009 — Simulated payment (card, UPI, card offers)
**Status:** Draft — awaiting Gate 1
**Approved by / date:**

---

## 1. In one sentence

The customer pays for their held order by demo card or demo UPI, gets any bank offer applied automatically, and lands on a clear "Order confirmed" page. A failed payment loses nothing and can be retried while the hold lasts.

## 2. Intended behavior

- **Product page:** a quiet line under the price shows the best real saving, for example "Save ₹600 with Aurora Bank credit cards". **All offers** shows the terms of all three fictional bank offers. If no offer applies at that price, the line is hidden.
- **Payment page:**
  - The F-008 countdown and summary stay.
  - Two tabs: **Card** and **UPI**.
  - Everything is labelled "Demo payment — no money is charged".
- **Card:**
  - Pick one of five demo cards, or type its number; any real card is refused before it leaves the browser.
  - The bank is recognised as you type, and a qualifying offer applies automatically. The button shows the final amount: **Pay ₹5,400**.
  - A demo bank OTP step follows; the code is shown on screen.
  - Three cards succeed; two fail on purpose (declined, insufficient funds), so failure can be demonstrated.
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
| One offer per order, applied automatically | No codes, no choosing; the best saving just happens |
| Banner only when a real saving exists | Honest; no fake urgency (CLAUDE.md §13) |
| Demo cards only | Guarantees no real card data enters the system (PAY-4) |
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

See `specification.md` §22:
- the offer catalogue and the one-offer rule;
- demo cards only;
- the bank OTP step;
- the UPI dialog and 5-minute window.

## 7. Approval

- [ ] Approved for implementation (Gate 1)
