# Feature Specification

## Feature

**ID:** F-010
**Name:** Orders — history, details, lifecycle, cancellation, returns, refunds and delivery OTP
**Status:** Draft — awaiting Gate 1
**Requirements:** ORD-2, ORD-3, ORD-4, ORD-5, SIM-3 and SIM-4 (order part, see §22), STATE-1, ANL-1 (`order_cancelled`)

**User decisions applied (2026-10-06):**
- **Q9 cancel:** the customer can cancel before Shipped, while the order is Order Confirmed or Processing.
- **Q9 returns:** within 7 days of Delivered, the customer chooses items (the full quantity of each) and gives a reason. Each item's refund is what was actually paid for it, with the bank offer shared out across the items.
- **Q9 refunds:** refunds go to the original payment method.
  - A cancellation refunds immediately.
  - A return moves Return Requested → Picked Up → Refunded, advanced by the demo operator. Stock goes back on sale at pickup.
- **Q16 delivery OTP:** a 4-digit code is created on Out for Delivery and shown to the customer. The operator must enter it to mark the order Delivered. After 3 wrong codes, delivery is blocked until a new code is issued.

**Proposed here, for confirmation at Gate 1** (§22):
- order simulation moves into this feature, with inventory simulation staying in F-011;
- operator access is a local demo page with no separate sign-in;
- the delivery charge is not refunded on returns.

---

## 1. Objective

After paying, customers can see all their orders, follow each one through its lifecycle, and act on it when appropriate: cancel before it ships, return items after delivery, and see their refunds. A demo operator can move orders along, so the whole journey can be demonstrated, including the delivery OTP handover.

## 2. User Problem

After checkout, shoppers want three things:
- reassurance: where is my order, and when does it arrive;
- control: can I still cancel; how do I return this;
- trust: did my refund actually happen, and where did it go?

## 3. User Intent

"Show me where my order is, let me cancel or return it without a fight, and tell me clearly where my money is."

## 4. User Stories

- As a customer, I want a list of my orders with status and arrival dates, newest first.
- As a customer, I want an order page with a timeline of each step, the items, the payment, the address and what I can do next.
- As a customer, I want to cancel an order before it ships and get my money back straight away.
- As a customer, I want to return some items within 7 days of delivery and follow the refund.
- As a customer whose order is out for delivery, I want my delivery code where I can find it quickly.
- As a demo operator, I want to move an order to its next step and complete delivery with the customer's code.

## 5. Functional Requirements

### 5.1 Lifecycle (ORD-3)

- FR-1 **Paid orders follow:**

  Order Confirmed → Processing → Shipped → Out for Delivery → Delivered

  Payment Successful is recorded at payment (F-009). Every step is recorded with its time.
- FR-2 **Side states:**
  - **Cancelled** (from Order Confirmed or Processing), with its refund;
  - for each returned item: **Return Requested → Picked Up → Refunded**.

  The order itself stays Delivered. It is labelled "Returned" when every item is returned, or "Partly returned" when some are.
- FR-3 Steps can only move forward, one at a time. The server enforces the allowed transitions; anything else is refused.

### 5.2 Order history (ORD-2)

- FR-4 `/account/orders` ("Your orders") is linked from the account menu, the account page and the confirmation page.
  - It lists **paid orders only**, newest first. Unpaid, expired and cancelled-before-payment holds from F-008 are not orders to the customer.
  - It shows 10 orders at a time, with **Show more**.
- FR-5 **Each card shows:**
  - the order number and date;
  - the status, with the arrival estimate, or the date it was delivered or cancelled;
  - up to 3 item thumbnails, plus a "+N" count;
  - the total paid.

  When the order is Out for Delivery, the card also shows the **delivery code** (FR-14). A card opens the order page.
- FR-6 **Empty state:** "No orders yet", with **Start shopping**.

### 5.3 Order page (ORD-2)

- FR-7 `/orders/:orderId` shows:
  - the order number, the date and the current status;
  - a **timeline**: done steps with times, the current step highlighted, future steps greyed; cancellation or return steps replace the future steps where relevant;
  - the items, with any return status per item;
  - **payment**: amount paid and masked method, plus any refunds ("₹5,400 refunded to Aurora Bank Visa •••• 4242 on 7 Oct");
  - the delivery address and option;
  - the next action, when there is one (FR-9, FR-11).
- FR-8 The F-009 confirmation page gains **View order**.

### 5.4 Cancellation (ORD-4, Q9)

- FR-9 **Cancel order** is offered while the order is Order Confirmed or Processing. It opens a confirmation that:
  - asks for a reason (optional, from a short list);
  - states the refund amount and destination.
- FR-10 **Confirming cancels the order and:**
  - **restocks:** the sold units go back on sale, because they never left;
  - **refunds immediately:** the full amount paid, including delivery, goes to the original method, recorded as Refund Initiated and Refunded at the same moment;
  - records `order_cancelled`;
  - adds a "Cancelled" step to the timeline.

  From Shipped onwards, the page instead explains that the order can be returned once delivered.

### 5.5 Returns and refunds (ORD-4, Q9)

- FR-11 **Return items** is offered for 7 days after Delivered, for any item not already returned. The page shows "Return window closes on 14 Oct".
  - The customer selects items (each returns at its full quantity) and picks a reason per item:
    - Damaged or defective
    - Wrong item received
    - Size or fit issue
    - Not as described
    - No longer needed
  - The confirmation shows the refund amount and destination before submitting.
- FR-12 **Refund amount per item** = the line total minus that line's share of the bank offer:
  - The offer is shared out in proportion to line totals, to the paisa, so the shares add up exactly to the offer.
  - The delivery charge is not refunded on returns (§22).
  - Several returns of the same order can never refund more than was paid.
- FR-13 **Return stages:**
  - **Return Requested:** waiting for pickup.
  - **Picked Up:** the units go back on sale and the refund is initiated.
  - **Refunded:** the refund is complete.

  The demo operator advances each return. The customer sees each stage with its time.

### 5.6 Delivery OTP (ORD-5, SIM-4, Q16)

- FR-14 **The code.**
  - When an order moves to Out for Delivery, a random 4-digit code is created.
  - Only the order's owner can see it: on the order page, prominently, and on the order list card. For example: "Share code 4831 with the delivery partner".
- FR-15 **Marking Delivered** requires the operator to enter the code.
  - A wrong code shows the attempts left.
  - After 3 wrong codes, delivery is blocked: the operator must **Issue new code**, which replaces the code the customer sees and resets the attempts.
  - The code stops being shown once delivered.

### 5.7 Demo order operator (SIM-3, SIM-4 — see §22)

- FR-16 `/sim/orders` is a plain operator page, clearly labelled "Demo operator — simulation only". It lists recent paid orders with their status. For each order it offers:
  - **Advance to <next step>**;
  - delivery-code entry (when Out for Delivery), with Issue new code;
  - for returns, **Mark picked up** and **Complete refund**.

  It has no customer data beyond order number, status, items and city. It's a simulation tool, not an admin dashboard (brief §16).

### 5.8 Analytics

- FR-17 `order_cancelled` `{ itemCount, totalPaise, reason? }` is recorded by the server at cancellation. No new event types are added: returns and refunds aren't in the brief's event set.

## 6. Non-Functional Requirements

- **Integrity:**
  - transitions, stock returns and refunds are each one transaction;
  - every transition is guarded by the current status, so a double click or a race can't cancel twice, restock twice or refund twice;
  - total refunds never exceed the amount paid.
- **Security:**
  - customer routes are owner-only;
  - the delivery code is visible only to the owner;
  - operator routes see no address details beyond the city.
- **Honesty (NFR-8):** refunds are labelled simulated ("Demo refund — no money moves").
- **Accessibility:**
  - the timeline is an ordered list, with each step's state given in text, not by colour alone;
  - dialogs trap focus;
  - the delivery code is readable by screen readers digit by digit.
- **Responsiveness:** works at 360 px. The timeline is vertical on mobile.

## 7. UX Requirements

- One obvious next action per order state: Cancel, Return items, or nothing.
- Each action says what will happen to the money before it is confirmed.
- No dead ends: when an action isn't available, the page says why and when it will be ("You can return items once delivered").

## 8. UI Requirements

- **Screens:**
  - Your orders;
  - Order page;
  - Cancel dialog;
  - Return flow (on the order page: select items, then reasons, then confirm);
  - Demo operator page.
- **Components:** OrderCard, OrderTimeline, OrderItems, RefundSummary, CancelOrderDialog, ReturnItemsDialog, DeliveryCode, SimOrderRow.
- **States:** loading (skeletons), empty (no orders), error, offline (actions disabled), not found.

## 9. Data Requirements

| Entity | Fields | Notes |
|---|---|---|
| Order | + status values `processing`, `shipped`, `out_for_delivery`, `delivered`; `cancelled` now also covers paid orders; `delivered_at`; `cancel_reason` | |
| OrderStatusHistory | + the new statuses and `cancelled` | From F-009 |
| DeliveryCode | orderId, code, attempts, issuedAt | One active code per order |
| Return | id, orderId, status (`requested` / `picked_up` / `refunded`), createdAt, pickedUpAt, refundedAt | |
| ReturnLine | returnId, orderLineId, reason, refundPaise | Each order line returns at most once |
| Refund | id, orderId, returnId?, amountPaise, method label, status (`initiated` / `refunded`), initiatedAt, refundedAt | |

## 10. API Requirements

**Customer** (sign-in required, owner only):

| Endpoint | Purpose |
|---|---|
| `GET /api/orders?cursor=` | Paid orders, newest first, 10 at a time |
| `GET /api/orders/:id` | Gains lifecycle, returns, refunds, delivery code (owner, when Out for Delivery), and `actions` (`canCancel`, `canReturn`, `returnWindowEndsAt`) |
| `POST /api/orders/:id/cancel` | Extends F-008: a paid order in Order Confirmed or Processing → Cancelled, restock, refund. `{ reason? }` |
| `POST /api/orders/:id/returns` | `{ lines: [{ orderLineId, reason }] }` → a return request |

**Operator** (§22):

| Endpoint | Purpose |
|---|---|
| `GET /api/sim/orders` | Recent paid orders |
| `POST /api/sim/orders/:id/advance` | Move to the next lifecycle step (not Delivered) |
| `POST /api/sim/orders/:id/deliver` | `{ code }` → Delivered, or `401 { attemptsLeft }`, or `423 DELIVERY_LOCKED` |
| `POST /api/sim/orders/:id/delivery-code` | Issue a new code |
| `POST /api/sim/returns/:id/pickup` | Return → Picked Up (restock, refund initiated) |
| `POST /api/sim/returns/:id/refund` | Refund → Refunded |

**Errors:** `409 INVALID_TRANSITION`, `409 NOT_CANCELLABLE`, `409 RETURN_WINDOW_CLOSED`, `409 ALREADY_RETURNED`.

## 11. State Management

- Server state: the order list (infinite query) and the order query. While an order is in progress, the order query refetches on window focus and every 30 seconds, so operator changes show up.
- Local state: dialog selections.

## 12. Loading States

- Skeleton cards and a skeleton order page.
- Action buttons show a spinner while pending.

## 13. Empty States

- No orders: FR-6.
- Operator page with no orders: "No paid orders yet".

## 14. Error States

- Action refused because the state changed (for example, it shipped meanwhile): "This order has just shipped, so it can no longer be cancelled", and the page refreshes.
- Not found or someone else's order: Not found.
- Offline: actions are disabled, with a notice.

## 15. Security Considerations

- Ownership is enforced on every customer route.
- The delivery code is returned only to the owner, and only while Out for Delivery.
- **Operator access:** the operator page is unauthenticated in this local demo (Q14 recommendation, §22). A production build would need operator authentication; that is out of scope.

## 16. Analytics

FR-17.

## 17. Acceptance Criteria

1. Your orders lists only paid orders, newest first, 10 at a time with Show more. Each card shows status, date, thumbnails and total. The empty state appears with no orders.
2. The order page shows the timeline with times, items, payment, address and the current next action. The confirmation page links to it.
3. The operator can advance Confirmed → Processing → Shipped → Out for Delivery, one step at a time. Each step appears on the customer's timeline. Skipping steps or going back is refused.
4. Cancel is offered in Order Confirmed and Processing only. Cancelling:
   - refunds the full amount paid to the original method immediately;
   - puts the stock back on sale;
   - records `order_cancelled`;
   - can't happen twice.

   From Shipped, the page explains that a return is possible after delivery.
5. Out for Delivery creates a 4-digit code, shown only to the owner (order page and list card). The operator's correct code marks the order Delivered. Wrong codes show the attempts left. After 3, delivery is blocked until Issue new code, and the customer then sees the new code.
6. Within 7 days of delivery, the customer can return selected items, with a reason each. After 7 days, Return items is gone and the API refuses. An item can't be returned twice.
7. Each returned item's refund is its paid share: the line total minus its share of the bank offer, with no delivery charge. All refunds for an order add up to no more than the amount paid.
8. Return stages Requested → Picked Up (stock back on sale, refund initiated) → Refunded are each visible to the customer with times. The order shows Returned or Partly returned.
9. No customer can see or act on another's orders, delivery code, or returns.
10. Keyboard and screen reader work, including the timeline, dialogs and delivery code; 360 px works.

## 18. Testing Strategy

- **Unit:**
  - transition rules;
  - offer share-out (exact to the paisa, sums match);
  - refund caps;
  - the return window boundary.
- **API:**
  - list (paid only, paging, ownership);
  - each transition and invalid transitions;
  - cancel (restock once, refund, event, state guard);
  - delivery code (owner only, attempts, lock, reissue);
  - returns (window, partial, twice refused, pickup restock once, refund staging);
  - refund totals.
- **Component:**
  - order list and empty state;
  - order page by state (timeline, actions, delivery code, refunds);
  - cancel dialog;
  - return flow;
  - operator page.
- **E2E:**
  - pay → View order → operator advances to Out for Delivery → customer sees the code → operator enters a wrong code, then the right one → Delivered → return one item → operator picks up and refunds → refund shown;
  - cancel while Processing (stock restored);
  - mobile.

## 19. Dependencies

- Depends on F-009: paid orders, payment labels, the offer discount.
- F-011 adds the inventory simulation (SIM-1, SIM-2) and can host the operator page under one console.

## 20. Out of Scope

- Exchanges
- Return pickup scheduling
- Partial-quantity returns within a line
- Refunds to a different method or store credit
- Invoices/PDFs
- Notifications (email, SMS, push)
- Courier tracking numbers and maps
- Reordering
- Reviews from orders (backlog)

## 21. Assumptions

- **Return window:** measured from the Delivered time: 7 × 24 hours.
- **Restocking at pickup:** units are restocked at pickup even if the return reason is "damaged". The simulation does not model damaged-stock write-offs.
- **Who advances orders:** orders only advance when the operator advances them (no automatic progression). F-011 may add automation.

## 22. Decisions Required From User

1. **Order simulation in F-010** (recommended): build the order part of the Simulation Console here — a small `/sim/orders` operator page for advancing orders, the delivery code, and return pickup and refund. Without it, F-010's lifecycle, delivery OTP and staged returns can't be demonstrated at Gate 2. F-011 keeps inventory simulation. This also answers Q6: the Simulation Console is in the MVP.
2. **Operator access (Q14):** a local demo page with a visible "Demo operator" label and no separate sign-in (recommended), versus requiring a demo operator password.
3. **Delivery charge on returns:** not refunded (recommended; the usual practice), versus refunded when every item in the order is returned.
