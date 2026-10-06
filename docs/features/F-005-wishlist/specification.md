# Feature Specification

## Feature

**ID:** F-005
**Name:** Wishlist
**Status:** Proposed (awaiting Gate 1)
**Requirements:** WISH-1, WISH-2, STATE-1, ANL-1 (`wishlist_added`, `wishlist_removed`)

---

## 1. Objective

Let any visitor save products they like for later, without an account, and move them to the cart when they are ready. Saved items are owned by the application and can be merged into an account later (F-006).

## 2. User Problem

Shoppers often find things they want but aren't ready to buy. Without a wishlist they lose track of them, or clutter the cart with items they don't intend to buy yet.

## 3. User Intent

"Remember this for me, and make it easy to buy later."

## 4. User Stories

- As a guest, I want to save a product with one tap from the product page or a product card.
- As a guest, I want to see everything I saved, with current prices and availability.
- As a guest, I want to move a saved product to my cart, choosing a size if needed.
- As a guest, I want to move something from my cart to my wishlist when I'm not ready to buy it.
- As a guest, I want to remove items I'm no longer interested in.

## 5. Functional Requirements

### 5.1 Saving (WISH-1)

- FR-1 A **heart toggle** appears:
  - on the product page, next to the purchase actions;
  - on every product card (listing, search, homepage rails, recently viewed), at the top-right corner of the image.
- FR-2 One tap saves the product; tapping again removes it. The heart is filled when saved. The change shows immediately and is undone with a message if the server rejects it.
- FR-3 The wishlist holds **products, not sizes**. A size is chosen when moving to the cart.
- FR-4 At most **100 products**. Saving a 101st shows "Your wishlist is full — remove something to add more."
- FR-5 Out-of-stock products can be saved (that is often the point).

### 5.2 Header

- FR-6 A heart icon with a saved-items count in the header, next to the cart, linking to `/wishlist`. Screen-reader name: "Wishlist, 4 items". On phones it sits alongside the cart icon in the same row.

### 5.3 Wishlist page (`/wishlist`)

- FR-7 A grid of product cards, newest saved first. Each card shows current price, discount, rating and real availability (fetched fresh, as in F-003).
- FR-8 Each card has:
  - **Remove** (the filled heart, or an × with label);
  - a primary **Move to cart** button, or a disabled **Out of stock** button when nothing can be bought.
- FR-9 **Move to cart (WISH-2):**
  - **Unsized product:** adds 1 to the cart (the F-004 rules apply), then removes it from the wishlist.
  - **Sized product:** opens a small size picker (a dialog on desktop, a bottom sheet on mobile). It shows available and sold-out sizes; choosing a size and confirming adds it to the cart and removes it from the wishlist.
  - **If the add fails** (sold out, limit reached): the item stays in the wishlist and the reason is shown.
  - **Confirmation:** "Moved to cart" is announced, with a **View cart** link.
- FR-10 Empty state: "Your wishlist is empty", a short hint ("Tap the heart on any product to save it"), **Start shopping**, and the Recently viewed rail.

### 5.4 Cart → wishlist (WISH-2)

- FR-11 Each cart line (F-004) gains **Move to wishlist**. It saves the product and removes the line from the cart. Undo restores the cart line, as with Remove. If the product is already saved, it is simply removed from the cart.

### 5.5 Persistence and ownership

- FR-12 The wishlist is stored by the application and identified by an anonymous random id in an HTTP-only cookie (`wishlist_id`, the same pattern as the cart). No account or personal data.
- FR-13 It persists across reloads and visits on the same browser. Wishlists untouched for **90 days** are deleted. That is longer than carts, because saving is for later.

### 5.6 Analytics

- FR-14 `wishlist_added`: `{ productId, source: 'product_page' | 'product_card' | 'cart' }`.
  `wishlist_removed`: `{ productId, source: 'product_page' | 'product_card' | 'wishlist_page' | 'moved_to_cart' }`.
  Moving to the cart also fires `cart_item_added` with `source: 'wishlist'`.

## 6. Non-Functional Requirements

- Performance: toggles update instantly; the wishlist page loads in one request.
- Accessibility:
  - hearts are toggle buttons (`aria-pressed`) named "Save <product> to wishlist" or "Remove <product> from wishlist";
  - the size picker is a labelled, focus-trapped dialog;
  - confirmations are announced.
- Responsiveness: card hearts are at least 40 px touch targets and don't cover product information. No horizontal scroll at 360 px.
- Security: same cookie properties and server validation as the cart. Ids are scoped to the cookie's wishlist.

## 7. UX Requirements

- Saving is one tap, anywhere a product appears, with no sign-up.
- On the wishlist page the primary action is Move to cart.
- No confirmation dialogs; a mistaken removal is undone by tapping the heart again.
- No fake urgency (no "X people saved this").

## 8. UI Requirements

- **Screens:** product page (heart), all product-card surfaces, wishlist page, cart page (Move to wishlist).
- **Components:** WishlistToggle, HeaderWishlistLink, WishlistPage, SizePickerDialog, EmptyWishlist.
- **States:**
  - wishlist page: loading, empty, populated, item moving, error, offline (read-only);
  - toggle: on, off, pending.

## 9. Data Requirements

| Entity | Fields | Owner | Notes |
|---|---|---|---|
| Wishlist | id (random), createdAt, updatedAt | Application | Deleted after 90 days of inactivity |
| WishlistItem | wishlistId, productId, addedAt | Application | Unique (wishlistId, productId); max 100 per wishlist |

## 10. API Requirements

| Endpoint | Purpose |
|---|---|
| `GET /api/wishlist` | `{ items: { product: ProductSummary, addedAt }[], count }`, newest first (empty if none) |
| `PUT /api/wishlist/items/:productSlug` | Save (idempotent); creates the wishlist and cookie on first save |
| `DELETE /api/wishlist/items/:productSlug` | Remove (idempotent) |

- **Errors:** `404 PRODUCT_NOT_FOUND`, `409 WISHLIST_FULL`.
- **Move to cart:** done by the client as add-to-cart (F-004 API, with size), then remove from the wishlist, so cart rules stay in one place.
- **Move to wishlist:** save, then remove the cart line.

## 11. State Management

- Server state: one TanStack Query entry for the wishlist, shared by every heart, the header and the page. Toggles update it optimistically and roll back on error.
- The set of saved product ids is derived from the same query, so every heart on screen agrees.

## 12. Loading States

- Hearts render as "not saved" until the wishlist loads, then update without layout shift.
- The page shows skeleton cards on first load.
- The Move to cart button shows a spinner while it runs.

## 13. Empty States

See FR-10.

## 14. Error States

- Toggle failure: the heart reverts and a short message is announced.
- Move to cart failure: the item stays and the reason is shown on the card.
- Page load failure: F-001 error state with Retry.
- Offline: hearts and move actions are disabled with a notice; the page stays readable.

## 15. Security Considerations

Same as F-004: an HTTP-only random id, server-side validation, and no client-supplied prices.

## 16. Analytics

`wishlist_added`, `wishlist_removed` (FR-14).

## 17. Acceptance Criteria

1. Tapping the heart on a product page or card saves it: the heart fills and the header count rises. Tapping again removes it, and every heart for that product on screen agrees.
2. The wishlist page lists saved products newest first, with current price and availability.
3. Move to cart for an unsized product adds it to the cart and removes it from the wishlist, with "Moved to cart · View cart".
4. Move to cart for a sized product asks for a size (sold-out sizes disabled), then adds that size and removes the item from the wishlist.
5. If moving fails (sold out or the cart limit), the item stays in the wishlist and the reason is shown.
6. Move to wishlist on a cart line saves the product and removes the line; Undo restores the line.
7. Out-of-stock products can be saved; on the wishlist page they show Out of stock instead of Move to cart.
8. Saving the same product twice keeps one entry. A 101st product is refused with the "wishlist is full" message.
9. The wishlist survives reload and browser restart; another browser has its own.
10. Empty wishlist shows the empty state with Start shopping.
11. `wishlist_added` and `wishlist_removed` are stored with the specified properties.
12. Failures roll back with a message; offline disables changes; no raw errors.
13. Keyboard and screen reader: hearts are named toggle buttons; the size picker is a focus-trapped dialog. No horizontal scroll at 360 px.

## 18. Testing Strategy

- **API:** save and remove (idempotent), cookie and isolation, cap of 100, unknown product, expiry, current prices in the list.
- **Component:** WishlistToggle (states, rollback, every heart in sync); wishlist page (move unsized and sized, failure, empty); cart Move to wishlist with Undo; header count.
- **E2E:** save from a card and a product page, move to cart (sized), move back from the cart, reload persistence, mobile.

## 19. Dependencies

F-003 (product data, sizes) and F-004 (cart API and page), both complete. F-006 merges guest wishlists into accounts.

## 20. Out of Scope

- Price-drop and back-in-stock notifications (Phase 2)
- Multiple or shared wishlists
- Saving a specific size
- Notes on items
- Wishlist-based recommendations (Phase 2)
- Account sync (F-006)

## 21. Assumptions

- 100 items and 90 days are sensible bounds for a guest wishlist.
- A product-level wishlist (size chosen later) matches common shopper expectations.

## 22. Decisions Required From User

None blocking. Please confirm or adjust when approving:
- product-level saving (size chosen when moving to the cart);
- the 100-item cap;
- the 90-day guest lifetime;
- hearts on every product card.
