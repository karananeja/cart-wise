# Technical Design — F-003 Product details, sizes and recently viewed

**Status:** Implementation
**Inputs:** specification.md (approved), ADR-002, F-001/F-002 designs

## 1. Data model

```sql
product_variants(id PK, product_id FK, label, sort_order, UNIQUE(product_id, label))
-- One row per sellable unit: variant_id NULL for unsized products, one row per size otherwise.
inventory(id PK, product_id FK, variant_id FK NULL, on_hand, reserved, updated_at, UNIQUE(product_id, variant_id))
product_reviews(id PK, product_id FK, rating, comment, reviewer_name, sort_order)
```

- **Schema change:** `inventory` was keyed by `product_id`. The database records `PRAGMA user_version`. When it is below the current version (2), catalog, inventory, variant and review tables are dropped and recreated, and the server re-seeds from the snapshot on start. Analytics events are kept. Acceptable for a seeded demo database; a migration tool is out of MVP scope.
- **Sizes:** a fixed map from category slug to size set (spec FR-6) in `inventory/sizes.ts`. The seed creates variants for products in those categories.
- **Stock:** unsized products keep the F-001 distribution. Sizes use their own deterministic PRNG seed (product id and size index): about 15% out of stock, 15% low (1–3), the rest 4–15. The seed guarantees at least one fully sold-out size and one low-stock size exist.
- **Reviews:** imported from the snapshot (rating, comment, reviewer name). Email and date are dropped. `products.rating` = mean of the review ratings to one decimal, or the catalog rating if there are no reviews (Q15).

## 2. Availability

- **Per unit:** `available = max(0, on_hand − reserved)`. `deriveAvailability(available)` applies the existing thresholds.
- **Per product:** `SUM` of per-unit available. Listing, search, filters and the in-stock facet all use this sum, so sized and unsized products behave the same.
- **Per size:** each size's availability is returned in the product detail.

## 3. API

- `GET /api/products/:slug` adds `sizes`, `reviews` and `reviewCount`.
- `ProductSummary.reviewCount` is added everywhere.
- `GET /api/products/batch?slugs=` returns summaries in request order. Slugs are validated, at most 24, de-duplicated, and unknown slugs are skipped. Registered before `/products/:slug`.

## 4. Web

- **Product page:** composed of `ProductGallery` (extended with previous/next, ←/→ on the focused gallery, and pointer swipe), `PurchasePanel` (price, `SizeSelector`, `AvailabilityLine`, catalog shipping info), `SpecificationList` and `ReviewList`.
- **SizeSelector:** native radio inputs styled as buttons inside a `fieldset` with legend "Size". Out-of-stock sizes are `disabled`, struck through, and get "(out of stock)" for screen readers. The selection is synced to `?size=` with `replace` navigation. An invalid or unavailable size in the URL is ignored.
- **AvailabilityLine:** an `aria-live` region.
- **Recently viewed:** `createLocalList` (a generic bounded, deduped, newest-first `localStorage` list with `useSyncExternalStore`). It backs both recent searches (refactored onto it; behaviour unchanged) and recently viewed (key `store.recentlyViewed`, max 20).
- **RecentlyViewedRail:** one batch query keyed by the slug list. Hidden when empty or errored. Optional `excludeSlug` and an optional Clear action.
- **`product_viewed`:** fired when the product data for a new product id first arrives in the mounted page (a ref holds the last tracked id). Size changes do not re-fire. Recording into recently viewed happens at the same moment.
