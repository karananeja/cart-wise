# Feature Specification

## Feature

**ID:** F-004
**Name:** Guest cart (with Add to cart on the product page)
**Status:** Complete (Gate 1 and Gate 2 approved 2026-10-06)
**Requirements:** CART-1..4, PDP-2, INV-1, INV-3, STATE-1, ANL-1 (`cart_item_added`, `cart_item_removed`)

---

## 1. Objective

Let any visitor build a cart without an account: add products (with a size where needed), review the cart, change quantities, remove items and see totals. The cart is owned by the application, persists across visits, and is ready to merge into an account later (F-006).

## 2. User Problem

Shoppers collect several items before deciding. They expect the cart to remember what they added, respect real stock and sizes, and show clearly what they will pay, all without being asked to sign up.

## 3. User Intent

"Put this aside for me, in my size, and show me what everything adds up to."

## 4. User Stories

- As a guest, I want to add a product to my cart in one tap, choosing a size first when the product has sizes.
- As a guest, I want to see how many items are in my cart from any page.
- As a guest, I want to change quantities and remove items, and undo a removal I didn't mean.
- As a guest, I want to see the totals and savings.
- As a guest, I want my cart to still be there when I come back.
- As a guest, I want to know when something in my cart is no longer available in the quantity I chose.

## 5. Functional Requirements

### 5.1 Add to cart (PDP-2)

- FR-1 The product page purchase panel gains one primary button: **Add to cart**.
- FR-2 **Sized products:** pressing Add to cart with no size selected does not add anything. It shows "Please select a size" next to the size group and moves focus to it. (The button stays enabled; a disabled button would not explain why.)
- FR-3 **Out of stock** (the product, or the selected size) shows a disabled **Out of stock** button instead.
- FR-4 A successful add puts 1 unit of that product and size in the cart. The header cart count updates, and "Added to cart" is announced.
- FR-5 *(Changed at Gate 2 review, 2026-10-06, user request.)* Once that product and size is in the cart, the Add to cart button is replaced in place by a **quantity stepper** (− quantity +) for that line. A separate **Go to cart** button/link sits beside it.
  - **+** increases the quantity within the FR-7 limits, and shows the reason at the limit.
  - **−** decreases it. At 1, − removes the item (labelled "Remove from cart") and the Add to cart button returns.
  - Changing size shows the state for the newly selected size.

### 5.2 Cart page (`/cart`)

- FR-6 Each line shows image, title (linking to the product page with its size), brand, size (if any), unit price with MRP and discount, a quantity stepper (− / number / +), the line total, and **Remove**.
- FR-7 **Quantity limits:** at least 1, and at most the lower of **10 per line** and the stock available for that product or size. At the limit the + button is disabled with a reason ("Max 10 per order" / "Only 3 available"). Decreasing below 1 is done with Remove.
- FR-8 **Remove** takes the line out immediately and shows "Removed <title>" with **Undo** for a few seconds.
- FR-9 **Summary panel:**
  - Items (count);
  - Total MRP;
  - Discount (negative, in green);
  - **Subtotal**;
  - Delivery: "Calculated at checkout";
  - a note that prices include taxes.

  Delivery charges and tax display rules are decided with checkout (open questions Q8, Q11).
- FR-10 **Continue shopping** link. **Proceed to checkout** is added by the checkout features (F-006/F-008), so no non-working button appears here.
- FR-11 **Current data:** prices and availability on the cart page always come from current catalog and inventory data, never from what was stored at add time.

### 5.3 Stock changes after adding (CART-4)

- FR-12 Adding does **not** reserve stock. Reservation happens at checkout (Q10).
- FR-13 If availability falls after adding (for example via the Store Simulation Console, F-011):
  - a line whose quantity exceeds what is available shows "Only N available — reduce quantity" and keeps the user's quantity until they change it;
  - a line whose product or size is out of stock shows "Out of stock" and is visually de-emphasised;
  - neither is removed silently.
- FR-14 Lines with problems are listed first, with a summary notice above the cart ("Some items need your attention"). Subtotal counts only lines that can currently be bought, and the summary says so.

### 5.4 Header

- FR-15 A cart icon with an item-count badge appears in the header on every page and links to `/cart`. Its screen-reader name is "Cart, 3 items".

### 5.5 Persistence and ownership

- FR-16 The cart lives in the application database (brief §22) and is identified by an anonymous random cart id in an HTTP-only cookie. No account or personal data is involved.
- FR-17 It persists across reloads and visits on the same browser. Carts untouched for **30 days** are deleted.
- FR-18 A cart line is identified by product + size. Adding the same product and size again (for example from another tab) increases its quantity within the FR-7 limits rather than creating a duplicate line.

### 5.6 Analytics

- FR-19 `cart_item_added`: `{ productId, size, quantity, pricePaise, source: 'product_page' }`.
  `cart_item_removed`: `{ productId, size, quantity, reason: 'removed' }`.
  Quantity changes are not separate events; an Undo re-adds the line with `cart_item_added` and `source: 'undo'`.

## 6. Non-Functional Requirements

- **Performance:** cart reads and updates under 100 ms locally. Quantity changes update the screen immediately and are rolled back with a message if the server rejects them.
- **Accessibility:**
  - steppers have labelled buttons and announce the new quantity;
  - Remove and Undo are keyboard reachable;
  - the "Added to cart" confirmation and the problem notices are announced;
  - the header badge has a text equivalent.
- **Responsiveness:** two columns (lines + summary) on desktop; on mobile, a single column with a sticky summary bar showing the subtotal.
- **Security:**
  - the cart id is random (128-bit) and stored HTTP-only with `SameSite=Lax`;
  - the server validates product, size and quantity on every change;
  - prices are never accepted from the client.
- **Reliability:** cart operations are idempotent where possible, and a failed update never leaves the screen out of step with the server.

## 7. UX Requirements

- **One obvious primary action** at each step: Add to cart, then Go to cart. The cart's primary action arrives with checkout.
- **Honest limits:** "Only 3 available" comes from real inventory; no fake urgency.
- **Low friction:** no sign-up; Undo instead of confirmation dialogs.
- **Fast feedback:** quantity updates on screen immediately, then is confirmed by the server (rolled back if rejected).

## 8. UI Requirements

- **Screens:** Product page (purchase panel), Cart page.
- **Components:** AddToCartButton, AddedToCartNotice, HeaderCartLink, CartLine, QuantityStepper, CartSummary, CartIssuesNotice, UndoToast, EmptyCart.
- **States:**
  - cart loading (skeleton lines);
  - empty;
  - with items;
  - with issues;
  - update in progress (line dimmed);
  - error;
  - offline (read-only with notice).

## 9. Data Requirements

| Entity | Fields | Owner | Notes |
|---|---|---|---|
| Cart | id (random), createdAt, updatedAt | Application | Anonymous; deleted after 30 days of inactivity |
| CartLine | cartId, productId, variantId (nullable), quantity, addedAt | Application | Unique (cartId, productId, variantId) |

No prices are stored on cart lines (FR-11).

## 10. API Requirements

All routes are under `/api/cart`. The cart is identified by its cookie; the first add creates the cart and sets the cookie.

| Endpoint | Purpose | Response |
|---|---|---|
| `GET /api/cart` | Current cart (empty if none) | `Cart` view |
| `POST /api/cart/lines` | `{ productSlug, size? , quantity? = 1 }` — add or increase | `Cart` view |
| `PATCH /api/cart/lines/:lineId` | `{ quantity }` | `Cart` view |
| `DELETE /api/cart/lines/:lineId` | Remove line | `Cart` view |

The **`Cart` view** contains:
- `lines[]`: id, product summary, size, quantity, availability for that size or product, max quantity, issue (`none` | `exceeds_stock` | `out_of_stock`), line total;
- `totals`: itemCount, mrpPaise, discountPaise, subtotalPaise;
- `hasIssues`.

**Errors:**
- `400 SIZE_REQUIRED`;
- `400 INVALID_SIZE`;
- `404 PRODUCT_NOT_FOUND`;
- `409 OUT_OF_STOCK`;
- `409 QUANTITY_LIMIT` (with the allowed maximum);
- `404 LINE_NOT_FOUND`.

Every response returns the full cart, so the client never needs to calculate totals itself.

## 11. State Management

- **Server state:** one TanStack Query cache entry for the cart, shared by the header badge, product page and cart page. Mutations write the returned cart into the cache.
- **Optimistic updates:** quantity changes and removals update the cache immediately and roll back on error.
- **Local UI state:** pending Undo (the removed line's product, size and quantity) and the "Added to cart" notice.

## 12. Loading States

- Product page: the Add to cart button shows a spinner and stays the same size while adding.
- Cart page: skeleton lines on first load. During an update the changed line is dimmed; other lines stay usable.
- Header badge: hidden until the cart has loaded (no flashing "0").

## 13. Empty States

Empty cart page: "Your cart is empty", a **Start shopping** button (to All products), and the Recently viewed rail if there is one.

## 14. Error States

- Add fails (network or server): inline message under the button with Retry, and the selection is kept.
- Server rejects an add: the matching message ("This size just sold out", "Only 3 available").
- Quantity or remove fails: the change is rolled back and a message is shown.
- Cart fails to load: F-001 error state with Retry.
- Offline: the cart page shows the last loaded cart read-only, with a notice; Add to cart shows "You're offline".

## 15. Security Considerations

See §6. In addition:
- prices and totals are computed server-side only;
- line ids are scoped to the cookie's cart (no access to other carts);
- the cookie holds no personal data;
- request bodies are size-limited and validated with Zod.

## 16. Analytics

`cart_item_added`, `cart_item_removed` (FR-19).

## 17. Acceptance Criteria

1. On an unsized in-stock product, Add to cart adds 1 unit and the header count goes from 0 to 1. The button is replaced by a − 1 + stepper with a separate Go to cart link. + raises the quantity (header count follows) up to the limit; − at 1 removes the item and brings back Add to cart.
2. On a sized product with no size selected, Add to cart shows "Please select a size", focuses the size group and adds nothing. After choosing a size it adds that size, and the cart line shows it.
3. A sold-out product or size shows a disabled Out of stock button.
4. The cart page lists lines with image, title, size, prices, quantity and line total. The summary shows Items, Total MRP, Discount, Subtotal and "Delivery: calculated at checkout", and the totals are correct.
5. + and − change quantity immediately. + stops at the lower of 10 and available stock, with the reason shown. The server rejects quantities above the limit even if the UI is bypassed.
6. Remove takes the line out and Undo restores it with the same size and quantity.
7. The cart survives reload and a browser restart (same cookie). A different browser has its own cart.
8. Adding the same product and size twice (for example from two tabs) results in one line with quantity 2.
9. If stock drops below a line's quantity, the line shows "Only N available" and the cart shows the attention notice; if it becomes 0, the line shows Out of stock. The subtotal excludes those lines and says so. Nothing is removed silently.
10. The empty cart shows the empty state with Start shopping.
11. `cart_item_added` and `cart_item_removed` are stored with the specified properties.
12. Failure and offline: a failed update rolls back with a message; offline, the cart is read-only with a notice; no raw errors are shown.
13. The cart page is keyboard operable, steppers announce the quantity, and there is no horizontal scroll at 360 px.

## 18. Testing Strategy

- **Unit** (api): line limits (stock vs 10), issue detection, totals, idempotent add, expiry cleanup.
- **API:** every endpoint and error code; cookie creation and isolation between carts; prices never taken from the client; line ownership.
- **Component:** AddToCartButton states (size required, out of stock, adding, go to cart); QuantityStepper limits; Remove and Undo; issues notice; optimistic rollback; header badge.
- **E2E:** add unsized and sized products, adjust quantity, remove and undo, reload persistence, stock-drop scenario (via a direct database update in the test API), mobile layout.

## 19. Dependencies

F-003 (complete): sizes, per-size inventory, product page. F-005 (wishlist) and F-006 (account merge) build on this cart.

## 20. Out of Scope

- Checkout and Proceed to checkout (F-006/F-008)
- Stock reservation (Q10, F-008)
- Delivery charges and tax breakdown (Q8, Q11)
- Coupons and promo codes
- Move to wishlist (F-005)
- Account carts and merging (F-006)
- Add to cart from listing cards
- Price-change notices
- Saved for later
- Mini-cart drawer

## 21. Assumptions

- A per-line maximum of 10 is a sensible default for a consumer store.
- Prices are tax-inclusive (Indian MRP convention), so the subtotal is what the shopper pays before delivery, pending Q11.
- 30 days is a reasonable lifetime for an untouched guest cart.

## 22. Decisions Required From User

None outstanding. 10 per line, 30-day guest carts and "Go to cart" approved 2026-10-06.
