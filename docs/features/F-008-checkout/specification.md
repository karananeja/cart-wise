# Feature Specification

## Feature

**ID:** F-008
**Name:** Checkout — address, delivery, summary and stock hold
**Status:** Complete (Gate 1 and Gate 2 approved 2026-10-06)
**Requirements:** CHK-1, CHK-2, CHK-3, INV-2, AUTH-4, STATE-1, ANL-1 (`checkout_started`)

**User decisions applied (2026-10-06):**
- **Q8 delivery:** Standard (3–5 days) is free on orders of ₹999 or more, otherwise ₹49; Express (1–2 days) is ₹149.
- **Q10 stock hold:** stock is reserved when payment starts and held for 10 minutes.
- **Q11 taxes:** prices include GST, and the summary says "Inclusive of all taxes".
- **Scope:** two features in order. F-008 ends on a payment page that, until F-009, only offers cancelling back to the cart.

---

## 1. Objective

Take a signed-in customer from their cart to a confirmed, priced order ready for payment in as few decisions as possible: where to deliver, how fast, and a final check of what they'll pay. Starting payment holds the stock so nobody else can take it while they pay.

## 2. User Problem

Checkout is where shoppers abandon: surprise costs, re-typing addresses, unclear delivery times, and items selling out mid-payment.

## 3. User Intent

"Get this to me — show me exactly what it costs and when it arrives, then let me pay."

## 4. User Stories

- As a shopper with a cart, I want to proceed to checkout, signing in only if I haven't already, and come straight back.
- As a customer, I want my default address preselected, and to switch to another or add a new one without losing my place.
- As a customer, I want to choose Standard or Express delivery and see the arrival dates and cost.
- As a customer, I want a clear summary (items, discounts, delivery, total) before paying.
- As a customer, I want my items held while I pay, and released if I change my mind.

## 5. Functional Requirements

### 5.1 Entering checkout

- FR-1 The cart page gains its primary action, **Proceed to checkout**. It is disabled, with a reason, when the cart is empty or has items that need attention (F-004 FR-13).
- FR-2 **Guests** go to sign-in with `returnTo=/checkout` and come back to checkout afterwards. The cart is merged as in F-006.
- FR-3 Checkout (`/checkout`) is one page with three numbered sections (Address, Delivery, Review). All three are visible; nothing is hidden behind "Next" buttons, so there are no unnecessary steps.

### 5.2 Address (CHK-1)

- FR-4 The default address is preselected, shown as a compact summary with **Change**.
- FR-5 **Change** expands the list of saved addresses as radio options (default first) with **Add a new address**. Adding opens the F-007 editor with `returnTo=/checkout`; the new address is then selected.
- FR-6 With no saved addresses, the section shows **Add delivery address** as its only action.

### 5.3 Delivery (Q8)

- FR-7 Two options, as radio cards:

  | Option | Arrival | Price |
  |---|---|---|
  | Standard | 3–5 days | Free on orders of ₹999+ (after discounts), else ₹49 |
  | Express | 1–2 days | ₹149 |

  - Each card shows the estimated date range ("Arrives Thu, 9 Oct – Sat, 11 Oct").
  - Standard is preselected.
  - When Standard isn't free, the card says how much more to add: "Add ₹120 more for free delivery".
- FR-8 All pincodes are serviceable in this simulation, and dates are estimated from today.

### 5.4 Review and summary (CHK-2)

- FR-9 Items are listed compactly: image, title, size, quantity and line price. **Edit cart** returns to the cart.
- FR-10 **Summary:**
  - Items (count);
  - Total MRP;
  - Discount;
  - Delivery (Free / ₹49 / ₹149);
  - **Total to pay**;
  - "Inclusive of all taxes" (Q11);
  - the selected address and delivery option, restated next to the button.
- FR-11 The server computes every amount; the client never does. If stock or prices change while the customer is on the page, the summary refreshes. If anything can no longer be bought, checkout shows the cart problems and sends them back to fix them.

### 5.5 Continue to payment — order creation and stock hold (CHK-3, INV-2, Q10)

- FR-12 **Continue to payment** creates an order with status **Pending Payment**. The order captures a snapshot of:
  - lines, with title, size, quantity, unit price and MRP;
  - the address;
  - the delivery option and estimate;
  - all totals.

  Prices are locked for the hold.
- FR-13 In the same transaction, each line's stock is **reserved**. If any line no longer has enough stock, nothing is reserved, no order is created, and the customer sees what changed (back to the cart with the problem flagged).
- FR-14 The hold lasts **10 minutes**. A customer has at most one Pending Payment order: starting checkout again cancels the previous one and releases its stock.
- FR-15 The cart is **not** emptied at this point. It is cleared only when payment succeeds (F-009), so a failed or abandoned payment keeps it (brief §13).

### 5.6 Payment page (interim, until F-009)

- FR-16 `/checkout/pay/:orderId` shows:
  - the order number and the amount to pay;
  - a countdown: "We're holding your items for 9:41";
  - **Cancel and return to cart**, which releases the stock and cancels the order.

  F-009 adds card, UPI and card offers to this page. Until then, no non-working payment controls are shown; a short note says payment methods are added next.
- FR-17 **When the hold expires:**
  - the order becomes **Payment expired** and the stock is released, by a server sweep and on next access;
  - the page says "Your hold expired — your cart is still here", with **Back to cart**.

### 5.7 Analytics

- FR-18 `checkout_started` fires once per visit, when checkout opens with buyable items: `{ itemCount, subtotalPaise }`. `payment_started` and `order_created` belong to F-009 (`order_created` after payment succeeds, brief §14).

## 6. Non-Functional Requirements

- **Integrity:** reservation is atomic. Availability (`on_hand − reserved`) can never go below zero, and two customers can't reserve the same last unit. Releases happen exactly once per order.
- **Security:** only the order's owner can see or cancel it; the address must belong to the customer; prices come from the server only.
- **Accessibility:** the sections are headed regions; radios for address and delivery; the summary is announced when it changes; the countdown is announced at key moments (5 minutes, 1 minute, expired), not every second.
- **Responsiveness:** on mobile the summary and the primary button sit in a sticky bottom bar showing the total. No horizontal scroll at 360 px.

## 7. UX Requirements

- One primary action per page: Proceed to checkout → Continue to payment.
- No surprises: the delivery cost and total are visible before the final button; the free-delivery threshold is explained.
- Preserve intent: sign-in and adding an address both return to checkout with selections kept.
- Honest holds: the countdown reflects a real reservation.

## 8. UI Requirements

- **Screens:** Cart (button), Checkout, Payment (interim).
- **Components:** CheckoutAddressSection, AddressRadioList, DeliveryOptions, CheckoutItems, OrderSummary, HoldCountdown, StickyCheckoutBar.
- **States:**
  - checkout: loading, no address, cart problems, quote refreshing, creating order, stock changed, error, offline;
  - payment page: holding, expired, cancelled.

## 9. Data Requirements

| Entity | Fields | Notes |
|---|---|---|
| Order | id (`ORD-` + 8 characters), userId, status, address snapshot, delivery option and estimate, itemCount, mrpPaise, discountPaise, deliveryPaise, totalPaise, createdAt, holdExpiresAt, holdReleasedAt, updatedAt | Status values now: `pending_payment`, `payment_expired`, `cancelled`. F-009/F-010 add the rest of the lifecycle |
| OrderLine | orderId, productId, variantId, title, size, thumbnailUrl, quantity, unitPricePaise, unitMrpPaise | Snapshot at creation |
| Inventory | `reserved` updated by orders | Already in schema |

## 10. API Requirements

All routes require sign-in.

| Endpoint | Purpose |
|---|---|
| `GET /api/checkout?addressId=&delivery=standard\|express` | Quote: cart lines (with issues), delivery options with price and estimate, totals, selected address, `canContinue` |
| `POST /api/orders` | `{ addressId, delivery }` → creates a Pending Payment order and reserves stock. Errors: `409 CART_CHANGED` (with the refreshed cart problems), `400 NO_ADDRESS`, `400 EMPTY_CART` |
| `GET /api/orders/:id` | Own order: status, lines, totals, address, `holdExpiresAt` |
| `POST /api/orders/:id/cancel` | Cancels a Pending Payment order and releases its stock |

## 11. State Management

- Server state:
  - the quote query is keyed by address and delivery option, and refetches when the cart changes;
  - the order query powers the payment page.
- Local state: the selected address and delivery option. They are also kept in the URL query so a reload or a return from add-address keeps them.

## 12. Loading States

- Skeleton sections on first load.
- While options change, the summary dims but keeps its layout.
- Continue to payment shows a spinner and is disabled while the order is created.

## 13. Empty States

- Empty cart at `/checkout`: back to the cart's empty state.
- No addresses: FR-6.

## 14. Error States

- Cart changed (stock or price): message plus Back to cart, with the problems flagged there.
- Order creation fails: a message, and the button can be retried.
- Payment page for someone else's or an unknown order: Not found.
- Offline: checkout is read-only and Continue is disabled with a notice.

## 15. Security Considerations

See §6. The order id is random enough not to be guessable, and access is checked against the owner anyway.

## 16. Analytics

`checkout_started` (FR-18).

## 17. Acceptance Criteria

1. Proceed to checkout from a guest cart goes to sign-in and returns to `/checkout` with the cart intact.
2. The default address is preselected. Change lists the saved addresses; adding a new one returns to checkout with it selected.
3. With no addresses, checkout asks to add one, and Continue is disabled until one exists.
4. Delivery options show prices and date ranges. Standard is free at ₹999+ after discounts (otherwise ₹49, with "Add ₹X more"); Express is ₹149. The total updates when switching.
5. The summary shows Items, MRP, Discount, Delivery, Total and "Inclusive of all taxes", and matches the server.
6. Continue to payment creates a Pending Payment order with locked prices, reserves stock (others see lower availability), and opens the payment page with a 10-minute countdown.
7. If stock changed before continuing, no order is created and the customer is sent back to the cart with the problem shown.
8. Cancel and return to cart releases the stock and cancels the order; the cart is unchanged.
9. After 10 minutes the order becomes Payment expired, stock is released exactly once, and the page offers Back to cart.
10. Starting checkout again with a Pending Payment order cancels the old one and releases its stock first.
11. Customers can't see or cancel other customers' orders.
12. `checkout_started` is recorded once per visit with itemCount and subtotal.
13. The mobile layout has a sticky total and button; keyboard and screen reader work; no horizontal scroll at 360 px.

## 18. Testing Strategy

- **Unit:** delivery pricing and estimates, totals.
- **API:**
  - quote;
  - order creation: reservation, locked prices, insufficient stock, one pending per user, ownership;
  - cancel and expiry release (exactly once);
  - concurrent last-unit reservation (two customers, one unit).
- **Component:** checkout sections (preselect, change, add, delivery switch, summary), sign-in redirect, stock-changed path, payment page countdown, cancel and expired states.
- **E2E:** full path cart → sign-in → checkout → address → Express → Continue → payment page → cancel → cart intact; stock held visible to another shopper; mobile.

## 19. Dependencies

F-004 (cart), F-006 (accounts) and F-007 (addresses), all complete. F-009 builds payment on this page. F-010 builds order history and the lifecycle.

## 20. Out of Scope

- Payment methods, card offers and payment success/failure (F-009)
- Order history, tracking and the lifecycle after payment (F-010)
- Coupons
- Gift options
- Splitting a cart into several shipments
- Pincode serviceability
- Cash on delivery
- Taxes beyond the inclusive note

## 21. Assumptions

- **Order before payment:** the order record exists from Pending Payment, which is needed to hold stock. It appears in the customer's order history only once paid (F-010).
- **Delivery dates:** estimates use calendar days, with no holiday handling.
- **Free-delivery threshold:** ₹999 is measured on the subtotal after discounts.

## 22. Decisions Required From User

None outstanding. Confirmed 2026-10-06.
