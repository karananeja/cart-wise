# Technical Design — F-012 Product discovery

**Status:** Implementation
**Inputs:** specification.md (approved 2026-10-06), F-003 catalog, F-004 cart, F-009/F-010 orders

## 1. Shared (`packages/shared/src/recommendations.ts`)

- **`RecommendedProduct`:** a `ProductSummary` plus `needsSize`.
- **Response types:** `ProductRecommendations`, `HomeRecommendations` and `CartRecommendations`.
- **Constants:**
  - the bought-together threshold (2 orders);
  - the limits;
  - `PAIRING_TITLES`;
  - `COMPLEMENTARY_CATEGORIES` (approved map).

## 2. API (`apps/api/src/recommendations/`)

- **Catalog snapshot:** `service.ts` loads every product per request: summary, tags, category, available and `needsSize`. That's about 194 rows, so it's cheap and always current with stock.
- **`similar(product, exclude)`:** FR-1 scoring, done in TypeScript, so it's deterministic and unit-testable.
- **`boughtTogether(productId)`:**
  - a SQL self-join of `order_lines` over paid orders (`paid_at IS NOT NULL`), with `COUNT(DISTINCT order_id) >= 2`;
  - in stock only;
  - up to 2.
- **`pairsWell(product)`:**
  - goes through the complementary categories in order;
  - picks the best in-stock item per category: rating first, then the closest price at or below this product's price, then the closest above;
  - up to 2.
- **`pairing(product)`:** returns bought-together items if there are any, else pairs-well items, else null.
- **`home(viewedSlugs, userId, cartProductIds)`:**
  - **`becauseViewed`:** the anchor is the first valid viewed slug. It runs `similar` on the anchor, excluding every viewed slug.
  - **`becauseBought`:** the anchor is the first line of the latest paid, non-cancelled order. It uses `pairing`, falling back to `similar`, and excludes all bought products and the cart.
- **`cart(cartProductIds)`:** pairings for up to 3 cart products (newest first), merged, de-duplicated, excluding the cart, up to 8.
- **Routes:**
  - `GET /products/:slug/recommendations` returns 404 for an unknown product.
  - `GET /recommendations/home?viewed=a,b`: the slugs are validated, at most 10.
  - `GET /cart/recommendations` uses the cart owner (guest cookie or account).

## 3. Web

- **`features/discovery/`:**
  - `PairingSection`: ticks, combined price, Add both/all, sized handling, partial-failure message;
  - `RecommendationRail`: built on ProductRail styling, with click and add tracking;
  - `StillInYourCart`;
  - hooks in `api.ts`.
- **Product page:** the pairing section and the similar rail sit below the details. For a product that needs a size, the bundle button reads the size selected on the page.
- **Home:** a `ContinueShopping` block above the existing sections; it is hidden for first-time visitors.
- **Cart page:** the rail sits below the lines and summary.
- **Analytics:** `recommendation_clicked { surface, kind, productId, position }`; adds from suggestions send `cart_item_added` with `source: 'recommendation'`.
- **Failure handling:** every section renders nothing on error or when empty.
