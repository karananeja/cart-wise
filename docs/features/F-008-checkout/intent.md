# Feature Intent

**Feature:** F-008 — Checkout (address, delivery, summary, stock hold)
**Status:** Approved
**Approved by / date:** User, 2026-10-06

---

## 1. In one sentence

From the cart, a customer signs in if needed, confirms where and how fast to deliver, sees exactly what they'll pay, and presses Continue to payment, which holds their items for 10 minutes while they pay.

## 2. Intended behavior

- The cart gets **Proceed to checkout** (disabled, with a reason, if the cart is empty or has items needing attention). Guests sign in and come straight back.
- **Checkout** is one page with three visible sections:
  1. **Address:** your default is preselected. **Change** lists your saved addresses; **Add a new address** uses the map flow and comes back with it selected.
  2. **Delivery:**
     - **Standard** (3–5 days) is free on ₹999+, otherwise ₹49, with "Add ₹X more for free delivery".
     - **Express** (1–2 days) is ₹149.
     - Each shows arrival dates.
  3. **Review:** the items, with **Edit cart**.
- **Summary:** Items, MRP, Discount, Delivery, **Total to pay**, and "Inclusive of all taxes". On phones, the total and the button stay in a bar at the bottom.
- **Continue to payment:**
  - creates your order (Pending Payment), locks the prices and holds the stock for 10 minutes;
  - if something sold out a moment ago, nothing is held, and you're shown what changed in the cart.
- **Payment page (for now):**
  - the amount, a countdown ("holding your items for 9:41"), and **Cancel and return to cart**;
  - card, UPI and card offers arrive in F-009;
  - if the hold runs out, the items go back on sale and your cart is still there.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| One page, three visible sections | Fewest steps; everything checkable at a glance (brief §12) |
| Default address and Standard preselected | Most customers just confirm |
| "Add ₹X more for free delivery" | Honest, useful nudge, not fake urgency |
| Hold starts at payment, 10 minutes | Your Q10 decision; browsing checkout never locks stock |
| Cart kept until payment succeeds | Brief §13: failure must not lose the cart |
| One unpaid hold per customer | Prevents stale holds blocking stock |

## 4. What this feature deliberately does not do

Payment methods and offers (F-009), order history and tracking (F-010), coupons, cash on delivery, split shipments, gift options.

## 5. How we will know it works

Acceptance criteria 1–13 in `specification.md` §17.

## 6. Decisions needed before implementation

Resolved 2026-10-06: one-page checkout with three visible sections; restarting checkout cancels the previous unpaid hold.

## 7. Approval

- [x] Approved for implementation (Gate 1) — 2026-10-06
