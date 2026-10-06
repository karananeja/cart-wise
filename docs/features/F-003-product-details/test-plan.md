# Test Plan

**Feature:** F-003 — Product details, sizes and recently viewed

## 1. Scope

Variant and inventory seeding, aggregate availability, review import and rating rule, product detail and batch endpoints, schema upgrade, size selector and URL sync, gallery navigation, reviews display, recently-viewed store and rails, `product_viewed`.

## 2. Risk areas

- Aggregate availability regressions in listings, filters and search (F-001/F-002 behaviour)
- Schema upgrade on an existing developer database
- Size state and URL edge cases
- Recently-viewed ordering, bounds and stale data

## 3. Tests

| Level | Area | File |
|---|---|---|
| Unit | api: size sets, variant stock determinism and distribution, review rating mean | `apps/api/src/inventory/inventory.test.ts`, `apps/api/src/catalog/mapping.test.ts` |
| API | detail sizes and reviews; aggregate availability in listing and in-stock filter; batch endpoint; schema upgrade keeps analytics | `apps/api/src/app.test.ts`, `apps/api/src/db/database.test.ts` |
| Unit | web: local list store (recent searches still pass; recently viewed cap 20) | `apps/web/src/lib/*.test.ts` |
| Component | SizeSelector + URL; gallery prev/next/keys; reviews; rails; `product_viewed` | `apps/web/src/features/catalog/pages/ProductPage.test.tsx`, `components/ProductGallery.test.tsx` |
| E2E | sized product flow; recently viewed across pages and reload; mobile | `e2e/product.spec.ts` |

## 4. Manual verification

Screenshots of sized and unsized product pages at 1280 and 375 px; homepage with the rail.

## 5. Results

| Run date | Command | Result | Notes |
|---|---|---|---|
