# Feature Specification

## Feature

**ID:** F-003
**Name:** Product details, sizes and recently viewed
**Status:** Proposed (awaiting Gate 1)
**Requirements:** PDP-1, PDP-3, RV-1, INV-1, INV-3, STATE-1, ANL-1 (`product_viewed`)
**User decisions applied:** Q4 — add application-owned sizes for apparel and footwear. Q5 — do not show DummyJSON reviews.

---

## 1. Objective

Replace the F-001 product page stub with a full product page that gives shoppers everything they need to decide: images, price, real availability, size choice where relevant, description and specifications. Remember what they looked at so they can get back to it.

## 2. User Problem

Shoppers cannot judge a product from a card. Clothing and shoes are unusable without sizes, and stock often differs by size. Shoppers who browse several products lose track of the ones they liked.

## 3. User Intent

"Tell me everything I need to decide on this product, including whether it's available in my size, and let me get back to things I looked at earlier."

## 4. User Stories

- As a guest, I want to see the product clearly, with all its images, so I know what I'm buying.
- As a guest, I want to choose my size and see straight away whether it's available.
- As a guest, I want price, discount and availability to be unambiguous and honest.
- As a guest, I want to find products I viewed earlier without searching again.

## 5. Functional Requirements

### 5.1 Product page (`/p/:productSlug`) — PDP-1

- FR-1 Layout: the gallery on the left (stacked on mobile) and the purchase panel on the right, with brand, title, rating, price block, availability, size selector (if sized), and short delivery info from the catalog. Description and specifications appear below.
- FR-2 Gallery: the existing thumbnails, plus previous/next controls on the main image, ←/→ keys when the gallery is focused, and swipe on touch screens. No zoom or lightbox (out of scope).
- FR-3 Rating shows the star value only. No review count or review text (Q5). The footer demo notice already covers rating data.
- FR-4 Breadcrumb: Home › Category › Product.
- FR-5 The purchase panel reserves the place for the primary action. **Add to cart arrives in F-004.** F-003 shows no non-working buttons. Until F-004, the panel ends at availability and size.

### 5.2 Sizes — PDP-3 (Q4)

- FR-6 Products in these categories have sizes, owned by the application (not DummyJSON):

  | Categories | Size set |
  |---|---|
  | Men's Shirts | S, M, L, XL, XXL |
  | Women's Dresses, Tops | XS, S, M, L, XL |
  | Men's Shoes | UK 6, 7, 8, 9, 10, 11 |
  | Women's Shoes | UK 3, 4, 5, 6, 7, 8 |

  That is 25 products. All other products have no sizes.
- FR-7 Price is the same for every size of a product.
- FR-8 Inventory is held **per size** for sized products and per product otherwise. It is seeded deterministically, and some sizes start out of stock so the state is demonstrable.
- FR-9 Size selector: one button per size, in size order. Each shows its state:
  - available — normal;
  - low stock — the button is unchanged, and on selection the availability line says "Only N left in M";
  - out of stock — struck through and not selectable, but still visible so the user knows the size exists.
- FR-10 No size is preselected. The availability line reads "Select a size" until one is chosen, then shows that size's availability. The chosen size is kept in the URL (`?size=M`), so a shared link or reload keeps it and F-004 can use it. An invalid or out-of-stock `size` in the URL is ignored.
- FR-11 Product-level availability (shown on cards, listings, search and filters) for sized products is derived from the total across sizes:
  - **Out of stock** when every size is out;
  - **Only N left** when the total available is 1–5;
  - otherwise **In stock**.
  This keeps F-001/F-002 behaviour unchanged for everything else.
- FR-12 Size guide, colour variants and per-size prices are out of scope.

### 5.3 Recently viewed — RV-1

- FR-13 Opening a product page records it in recently viewed on this device: most recent first, no duplicates, **at most 20** (oldest dropped). Only the product slug and time are stored.
- FR-14 Shown as:
  - a **"Recently viewed"** rail on the homepage, above "Top rated", only when it has at least one product;
  - a **"Recently viewed"** rail on the product page, excluding the product being viewed, only when there is something else to show.
- FR-15 Rails always show current price and availability, fetched from the API rather than stored copies. Products that no longer exist are dropped silently.
- FR-16 The homepage rail has a **"Clear"** action that empties the history.
- FR-17 Guest-only and per device (local storage). If storage is unavailable, nothing is recorded and nothing breaks. Account merge is part of F-006.

### 5.4 Analytics

- FR-18 `product_viewed` once per product page view, after the product loads: `{ productId, categorySlug, pricePaise, availability }`. Selecting a size does not fire it again.

## 6. Non-Functional Requirements

- Performance: the product page renders from one product request. Recently-viewed rails make one batch request. Images below the fold are lazy.
- Accessibility:
  - the size selector is a labelled radio group;
  - out-of-stock sizes are announced as unavailable;
  - availability changes are announced;
  - gallery controls have labels;
  - keyboard operable throughout.
- Responsiveness: single column below 768 px, with the purchase panel directly after the gallery; no horizontal scroll at 360 px.
- Reliability: the rails never block the page; if they fail, they are simply hidden.

## 7. UX Requirements

- Primary decision on the page: choosing a size (for sized products). The purchase action follows in F-004.
- Honest signals only: "Only N left" reflects real application inventory; no "X people viewing" or similar.
- Progressive disclosure: the description and specifications sit below the purchase panel.
- No authentication.

## 8. UI Requirements

- **Screens:** product page; homepage (adds the rail).
- **Components:** ProductGallery (extended), PurchasePanel, SizeSelector, AvailabilityLine, ProductDescription, SpecificationList, RecentlyViewedRail.
- **States:**
  - product page: loading skeleton, success, not found, error with Retry, offline (from F-001);
  - rails: hidden when empty or failed.

## 9. Data Requirements

| Entity | Fields | Owner | Notes |
|---|---|---|---|
| ProductVariant | id, productId, sizeLabel, sortOrder | Application | Created at seed for the 25 sized products |
| Inventory | variantId (sized) or productId (unsized), onHand, reserved | Application | Per sellable unit; seeded deterministically |
| Recently viewed (guest) | slug, viewedAt | Browser | `localStorage`, max 20 |

Catalog import is unchanged. Variants are added by the application seed, never imported.

## 10. API Requirements

| Endpoint | Change |
|---|---|
| `GET /api/products/:slug` | Adds `sizes: { label, availability }[]` (empty for unsized). Product `availability` is the aggregate (FR-11) |
| `GET /api/products/batch?slugs=a,b,c` | New. Returns `{ items: ProductSummary[] }` in the requested order, skipping unknown slugs; at most 24 slugs |
| `GET /api/products` and search | Unchanged contract. Availability and the in-stock filter use the aggregate |

## 11. State Management

- Server state: product query (existing); batch query for rails.
- URL: `size` on the product page.
- Persistent client: recently-viewed store (same pattern as recent searches).

## 12. Loading States

- Product page: skeleton matching the final layout (existing pattern, extended to the panel).
- Rails: skeleton cards while loading.

## 13. Empty States

- No recently viewed products: rails not rendered.
- Product with one image: no gallery controls (existing).

## 14. Error States

- Product: not found, or error with Retry (existing).
- Rails: hidden on error (non-critical).
- Invalid `size` in the URL: ignored.

## 15. Security Considerations

The batch endpoint validates slugs and caps their number. No personal data is involved.

## 16. Analytics

`product_viewed` (FR-18).

## 17. Acceptance Criteria

1. A product page shows a gallery with thumbnails, previous/next, keyboard arrows and swipe, plus brand, title, rating (no reviews), price, discount, availability, description and specifications.
2. No DummyJSON review content appears anywhere in the app.
3. A Men's Shirts product shows sizes S–XXL; a Men's Shoes product shows UK 6–11; a Laptops product shows no size selector.
4. Out-of-stock sizes are visible, struck through and not selectable; selecting a low-stock size shows "Only N left in <size>".
5. The selected size appears in the URL and survives reload; an invalid size in the URL is ignored.
6. Per-size inventory is seeded deterministically; at least one sized product has an out-of-stock size and one has a low-stock size.
7. A sized product with every size out of stock shows "Out of stock" on its card and is excluded by "In stock only". A sized product's card badge reflects the total across sizes.
8. Viewing products A, B, C shows a homepage "Recently viewed" rail C, B, A with current prices. On C's page the rail shows B, A.
9. Recently viewed holds at most 20 products, never duplicates, survives reload, and "Clear" empties it.
10. With storage blocked, product pages work and no rail appears.
11. `product_viewed` is stored once per product page view with the specified properties.
12. Keyboard and screen reader: the size radio group, gallery controls and announced availability work without a mouse; no horizontal scroll at 360 px.

## 18. Testing Strategy

- **Unit** (api): variant seeding (size sets, determinism, distribution); aggregate availability; batch endpoint ordering and limits.
- **Unit** (web): recently-viewed store (order, dedupe, cap, clear, storage blocked).
- **API:** product detail sizes; aggregate availability in listings and the in-stock filter; batch endpoint.
- **Component:** SizeSelector states and URL sync; gallery navigation; RecentlyViewedRail; `product_viewed`.
- **E2E:** sized product flow (select size, low/out states, reload keeps size); recently-viewed across pages and reload; mobile layout.

## 19. Dependencies

F-001 and F-002 (complete). F-004 builds Add to cart on this page and uses the selected size.

## 20. Out of Scope

Add to cart (F-004), wishlist (F-005), reviews (Q5; application-owned reviews are in the backlog), related or "frequently bought together" products (Phase 2), size guide, colour variants, per-size prices, image zoom/lightbox, delivery-date estimates (F-008), share buttons.

## 21. Assumptions

- Size sets in FR-6 are reasonable defaults for an Indian store (UK shoe sizing).
- The existing catalog `rating` remains visible (Q5 covers reviews, not the star rating).
- The 20-item recently-viewed limit balances usefulness and the brief's "not unbounded" rule.

## 22. Decisions Required From User

None blocking. Please confirm or adjust the size sets in FR-6 when approving.
