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
| 2026-10-06 | `pnpm test` | 162 passed (shared 16, api 89, web 57) | |
| 2026-10-06 | `pnpm e2e --repeat-each=3 --workers=2` | 51 passed (17 tests × 3) | F-001, F-002 and F-003 suites; no flakes |
| 2026-10-06 | `pnpm typecheck`, `pnpm build` | Clean / succeeds | |
| 2026-10-06 | Manual (screenshots) | Pass | Sized product (1280, 375 px), homepage rail; no console errors; local DB at schema v2 with analytics kept |

### Defects found during testing

- A product page test found two `role="img"` elements after the rating gained an accessible label; test selector made specific (no product defect).
- Test-only timing issues: analytics events queued by earlier tests, and reading the previous page's rail before navigation finished.
