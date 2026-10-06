# Feature Specification

## Feature

**ID:** F-012
**Name:** Product discovery — related products, frequently bought together, continue shopping
**Status:** Acceptance — awaiting Gate 2 (Gate 1 approved 2026-10-06)
**Requirements:** Brief §17 (deterministic recommendations), §24 Next items 14–16 and 20 (related products, frequently bought together, continue shopping, improved discovery homepage), ANL-1 (`recommendation_clicked`)

**User decisions applied (2026-10-06):**
- **Pairings:** "Frequently bought together" appears only when at least 2 real orders contained both items. Otherwise "Pairs well with" is shown, from a small complementary-category map. The label always says which one it is.
- **Bundle add:** a one-tap "Add both to cart" / "Add all 3 to cart" for items without sizes. Sized items show "Choose size" instead. No bundle discount.
- **Homepage:**
  - "Still in your cart" when the cart has items;
  - "Because you viewed ‹product›";
  - for signed-in customers with orders, "Because you bought ‹product›";
  - the existing rails stay below.
- **Cart page:** one "Pairs well with your cart" rail, placed below the checkout action.

---

## 1. Objective

Help shoppers find the next relevant product without searching again, using clear, explainable rules rather than opaque personalisation.

## 2. User Problem

After viewing or buying something, shoppers have to start over to find alternatives or companions. Returning visitors lose their place.

## 3. User Intent

"Show me things like this, things that go with this, and pick up where I left off."

## 4. User Stories

- As a shopper on a product page, I want similar alternatives and items that go with it.
- As a shopper, I want to add a product and its companion in one tap.
- As a returning visitor, I want the homepage to remember what I was looking at and what's in my cart.
- As a customer reviewing my cart, I want to spot a useful add-on without it getting in the way of checkout.

## 5. Functional Requirements

### 5.1 Rules (deterministic, explainable)

- FR-1 **You may also like** (similar items). Candidates are other products in the same category, scored by:
  - shared tags (×3 each);
  - the same brand (+2);
  - price within ±30% (+2) or ±60% (+1).

  Ties are broken by rating, then id. Out-of-stock items go last, not hidden. Up to 12 results; the product itself is excluded.
- FR-2 **Frequently bought together.**
  - Products that appeared in the same paid order as this one in at least 2 different paid orders (cancelled orders count; unpaid holds do not).
  - Ranked by the number of such orders, up to 2.
- FR-3 **Pairs well with** (when FR-2 gives nothing).
  - Products from the complementary categories of this product's category (§9), ranked by rating, then the closest price below this product's price.
  - In-stock only, up to 2, at most one per complementary category.
  - Categories with no mapping show neither section.
- FR-4 **Because you viewed ‹X›.** FR-1 for the most recently viewed product, excluding products the visitor has viewed in the last 10 views. It uses the existing recently viewed list.
- FR-5 **Because you bought ‹X›.**
  - Signed-in customers with paid, non-cancelled orders only.
  - It applies FR-2/FR-3 pairings, falling back to FR-1, to the most recently bought product.
  - Products already bought, or currently in the cart, are excluded.
- FR-6 **Pairs well with your cart.** FR-2/FR-3 pairings for up to 3 cart products, merged and de-duplicated. Items already in the cart are excluded. Up to 8.

### 5.2 Product page

- FR-7 Below the product details, in this order:
  1. the pairing section (FR-2 or FR-3), with its honest title;
  2. **You may also like** (a rail).
- FR-8 **The pairing section** shows this product and its 1–2 companions as a compact group with "+" separators, ticked by default, with:
  - the combined price;
  - **Add both to cart** (or **Add all 3 to cart**).

  The customer can untick companions. With none ticked, the group shows "Tick an item to add them together" and no button, so the page never has two identically named "Add to cart" buttons. (Clarified during implementation, 2026-10-06; the page's own Add to cart covers that case.)
  - **Sized products** can't be ticked. They show **Choose size**, which links to their page. If this product itself needs a size, the button is disabled with "Choose a size above first" until a size is selected on the page.
  - **Adding** uses the normal cart rules (F-004). If an item can't be added (stock or limit), the others are still added, and a short message names what wasn't.

### 5.3 Homepage (continue shopping, improved discovery)

- FR-9 For visitors with history, before the existing sections:
  1. **Still in your cart:** up to 4 thumbnails, the item count, the subtotal and **Go to cart**. Shown only when the cart has items.
  2. **Because you viewed ‹X›:** a rail (FR-4), shown when there is recently viewed history.
  3. **Because you bought ‹X›:** a rail (FR-5), for signed-in customers with orders.

  First-time visitors see the homepage as today.

### 5.4 Cart page

- FR-10 **Pairs well with your cart** (FR-6) is a rail shown below the cart lines and summary, never above or beside the checkout button. It is hidden when the cart is empty or the rail would be empty.

### 5.5 Analytics (ANL-1)

- FR-11 `recommendation_clicked { surface, kind, productId, position }`:
  - `surface`: `product`, `home` or `cart`;
  - `kind`: `similar`, `bought_together`, `pairs_well`, `because_viewed` or `because_bought`.

  It is recorded when a suggested product is opened or added from a suggestion. `cart_item_added` keeps firing as usual, with `source: 'recommendation'`.

## 6. Non-Functional Requirements

- **Honest labelling:** "Frequently bought together" appears only when FR-2's real threshold is met. No invented popularity ("customers love", "trending") is added.
- **Performance:** the rules run on the server with indexed queries. A product page adds one request, and all rails load after the main content without pushing it down: they have fixed-height placeholders.
- **Privacy:** co-purchase counts are aggregate (number of orders). No customer is identifiable from a suggestion.
- **Accessibility:** rails are labelled regions; the pairing checkboxes are labelled with the product names; the combined price updates politely.
- **Responsiveness:** works at 360 px. Rails scroll horizontally, as existing rails do, and the pairing group stacks.

## 7. UX Requirements

- One primary action per page stays intact. The suggestion add buttons are secondary in style.
- Suggestions never block or delay the product, cart or checkout actions.
- Every section's title explains why the items are there.

## 8. UI Requirements

- **Screens:** Product page, Homepage, Cart page.
- **Components:**
  - PairingSection (bundle);
  - RecommendationRail, which reuses ProductRail styling;
  - StillInYourCart.
- **States:** loading (placeholders), empty (section hidden), error (section hidden, so a failure never breaks the page), offline (hidden).

## 9. Data Requirements

| Entity | Fields | Notes |
|---|---|---|
| Complementary category map (static, API) | category → complementary categories | Draft below; editable later |
| Orders / order lines | Existing | Co-purchase counts from paid orders |

**Draft complementary map** (categories in the catalog):

| Category | Pairs well with |
|---|---|
| smartphones | mobile-accessories |
| tablets | mobile-accessories |
| laptops | mobile-accessories |
| mobile-accessories | smartphones |
| mens-shirts | mens-shoes, mens-watches |
| mens-shoes | mens-shirts |
| mens-watches | mens-shirts, sunglasses |
| tops | womens-jewellery, womens-bags |
| womens-dresses | womens-shoes, womens-jewellery |
| womens-shoes | womens-dresses, womens-bags |
| womens-bags | womens-jewellery, sunglasses |
| womens-jewellery | womens-dresses |
| womens-watches | womens-jewellery |
| sunglasses | mens-watches, womens-bags |
| beauty | skin-care, fragrances |
| skin-care | beauty |
| fragrances | beauty |
| furniture | home-decoration |
| home-decoration | furniture |
| kitchen-accessories | groceries |
| groceries | kitchen-accessories |
| sports-accessories | (none) |
| vehicle, motorcycle | (none) |

## 10. API Requirements

| Endpoint | Purpose |
|---|---|
| `GET /api/products/:slug/recommendations` | `{ pairing: { kind: 'bought_together' \| 'pairs_well', items } \| null, similar: items }` |
| `GET /api/recommendations/home?viewed=slug1,slug2,…` | `{ becauseViewed: { anchor, items } \| null, becauseBought: { anchor, items } \| null }`. `viewed` is the client's recently viewed list (up to 10); `becauseBought` is for signed-in customers only |
| `GET /api/cart/recommendations` | `{ items }` for the current cart (guest or account) |

The existing cart endpoints serve "Still in your cart". Items are the standard product card shape, with availability.

## 11. State Management

Server state only: three queries, keyed by product slug, by the viewed list and signed-in status, and by the cart. Recommendations go stale with the cart.

## 12. Loading States

Fixed-height rail and group placeholders below the main content.

## 13. Empty States

Sections are hidden when empty. There are no "nothing to suggest" messages.

## 14. Error States

Sections are hidden on error. A failure never shows an error block on product, home or cart pages.

## 15. Security Considerations

- Read-only endpoints. `becauseBought` uses the session's own orders only.
- The `viewed` list is validated (slugs, at most 10).

## 16. Analytics

FR-11.

## 17. Acceptance Criteria

1. A product page shows **You may also like**: same-category items ranked by shared tags, brand and price closeness, out-of-stock last, never the product itself.
2. With 2 or more real paid orders containing products A and B, A's page shows **Frequently bought together** with B. With fewer, it shows **Pairs well with**, from the complementary map. Categories without a mapping show neither.
3. **Add both / all to cart** adds the ticked unsized items in one tap. Sized companions offer Choose size. If the page product needs a size, the button waits for one. Partial failures say which item wasn't added.
4. The homepage shows **Still in your cart** (when the cart has items) and **Because you viewed ‹X›**. Signed-in customers with orders also see **Because you bought ‹X›**, with no items already bought or in the cart. First-time visitors see today's homepage.
5. The cart shows **Pairs well with your cart** below the checkout action, excluding items in the cart. It is hidden when empty.
6. `recommendation_clicked` is recorded with surface, kind, product and position. Adds from suggestions record `cart_item_added` with `source: 'recommendation'`.
7. Suggestions never delay or displace the main content, and failures hide the section.
8. Keyboard, screen reader and 360 px work.

## 18. Testing Strategy

- **Unit:**
  - similarity scoring (tags, brand, price bands, ties, out-of-stock last);
  - the co-purchase threshold and ranking;
  - the complementary fallback;
  - the exclusions (viewed, bought, in cart).
- **API:**
  - each endpoint;
  - the threshold flip from Pairs well with to Frequently bought together after the 2nd order;
  - signed-in only "Because you bought";
  - `viewed` validation.
- **Component:**
  - the pairing group (ticks, combined price, sized handling, partial failure);
  - the home sections by visitor type;
  - the cart rail placement;
  - the analytics calls.
- **E2E:**
  - view a phone → its page shows Pairs well with accessories → Add both → cart has both → cart shows Pairs well with your cart → homepage shows Still in your cart and Because you viewed;
  - after 2 orders containing the pair → Frequently bought together;
  - mobile.

## 19. Dependencies

F-003 (product page), F-004 (cart), F-005/F-003 (recently viewed), F-009/F-010 (paid orders), and the MVP wrap-up analytics identity decision (server events carry the account id).

## 20. Out of Scope

- AI or ML recommendations (Phase 3)
- Wishlist-based suggestions
- Email or push "you might like"
- Bundle discounts
- Trending or popularity badges
- Personalised search ranking

## 21. Assumptions

- **Order threshold:** "at least 2 orders" counts distinct orders, not units.
- **Map review:** the complementary map is a starting point; the owner can review it at Gate 1.
- **No session caching:** suggestions are computed per request, which is cheap at this catalog size.

## 22. Decisions Required From User

None outstanding. The complementary category map in §9 was approved as drafted (Gate 1, 2026-10-06).
