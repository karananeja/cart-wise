# Feature Intent

**Feature:** F-010 — Orders (history, details, lifecycle, cancellation, returns, refunds, delivery OTP)
**Status:** Draft — decisions recorded, awaiting Gate 1 approval
**Approved by / date:**

---

## 1. In one sentence

Customers can see every paid order and its timeline, cancel before it ships with an instant refund, and return items within 7 days of delivery with a staged refund. A demo operator moves orders along, completing delivery with the customer's 4-digit code.

## 2. Intended behavior

- **Your orders** (account menu): paid orders, newest first, each showing status, date, thumbnails and total. When an order is out for delivery, its delivery code is right on the card.
- **Order page:**
  - a timeline (Confirmed → Processing → Shipped → Out for Delivery → Delivered, with times);
  - the items;
  - the payment and any refunds ("₹5,400 refunded to Aurora Bank Visa •••• 4242");
  - the address;
  - one next action.
- **Cancel** (while Confirmed or Processing):
  - a confirmation shows the refund;
  - the money goes back to your card or UPI immediately;
  - the items go back on sale.
- **Delivery code:**
  - on Out for Delivery you get a 4-digit code;
  - the delivery partner (the demo operator) must enter it to mark the order Delivered;
  - 3 wrong tries block delivery until a new code is issued.
- **Returns** (7 days after delivery):
  - pick the items and a reason each;
  - see the refund before confirming: what you paid for those items, with the bank offer shared out, and no delivery charge;
  - stages: Return Requested → Picked Up (items back on sale, refund started) → Refunded.
- **Demo operator page** (`/sim/orders`), behind a demo operator password (default `demo-operator` locally) and clearly labelled as simulation:
  - Advance;
  - Enter delivery code;
  - Issue new code;
  - Mark picked up;
  - Complete refund.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| One next action per state | Simple decisions (CLAUDE.md §11) |
| Refund amount and destination shown before confirming | Trust; no surprises |
| Delivery code on the list card as well as the order page | It's needed at the door, fast |
| Unpaid holds hidden from order history | They were never orders to the customer |
| Operator page plain and labelled | Brief §16: minimal simulation, not an admin dashboard |
| Operator password, separate from customer accounts | Your decision; customers can't move their own orders along |

## 4. What this feature deliberately does not do

- Exchanges
- Pickup scheduling
- Partial-quantity returns within a line
- Store credit
- Invoices
- Notifications
- Courier tracking
- Reorder
- Inventory simulation (F-011)

## 5. How we will know it works

Acceptance criteria 1–10 in `specification.md` §17.

## 6. Decisions needed before implementation

Resolved 2026-10-06 (`specification.md` §22):
- order simulation is in F-010;
- the operator page uses a demo operator password;
- the delivery charge is not refunded on returns.

## 7. Approval

- [ ] Approved for implementation (Gate 1)
