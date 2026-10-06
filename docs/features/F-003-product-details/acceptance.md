# Acceptance

**Feature:** F-003 — Product details, sizes and recently viewed
**Status:** Accepted (Gate 2, 2026-10-06)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Gallery (thumbnails, prev/next, arrows, swipe) and full product information | Pass | `ProductGallery.test.tsx`; `ProductPage.test.tsx`; E2E gallery; screenshots. Swipe implemented with pointer events; not covered by automated tests |
| 2 | Reviews listed (stars, name, comment), unlabelled, no emails; rating = average | Pass | `app.test.ts` (mascara 4.0 from 3, 4, 5; no `@`); `mapping.test.ts`; E2E |
| 3 | Shirts S–XXL, men's shoes UK 6–11, laptops no sizes | Pass | `app.test.ts`, `inventory.test.ts` |
| 4 | Sold-out sizes visible and disabled; low size shows "Only N left in <size>" | Pass | `ProductPage.test.tsx`; E2E on seeded data |
| 5 | Size in URL, survives reload; invalid or sold-out size ignored | Pass | `ProductPage.test.tsx`; E2E reload |
| 6 | Deterministic per-size stock with sold-out and low sizes | Pass | `inventory.test.ts`; `app.test.ts` |
| 7 | All sizes out → Out of stock and excluded by In stock only; badge = total | Pass | `app.test.ts` (aggregate low / out / in, in-stock filter) |
| 8 | Recently viewed: homepage newest first; product page excludes current | Pass | `ProductPage.test.tsx`; E2E |
| 9 | ≤ 20, no duplicates, survives reload, Clear | Pass | `recentlyViewed.test.ts`; E2E |
| 10 | Storage blocked → pages work, no rail | Pass | Shared `localList` behaviour covered by the blocked-storage test in `recentSearches.test.ts` |
| 11 | `product_viewed` once per view, not on size change | Pass | `ProductPage.test.tsx` |
| 12 | Keyboard/screen reader: size radios, gallery controls, announced availability; 360 px | Pass | Native radio group with legend; labelled gallery buttons; `aria-live` availability; E2E mobile |

## 2. Test results summary

162 unit/API/component tests; 17 E2E tests passing on 3 repeated runs; typecheck and build clean. Details in `test-plan.md`.

## 3. Known issues and limitations

- **Ratings changed:** star ratings now follow the review average (Q15). Values, rating-filter counts and "Top rated" order differ from F-001.
- **Database rebuild:** local databases from before F-003 are rebuilt automatically on first start (schema v2). Catalog and stock are re-seeded and analytics are kept.
- **No Add to cart yet:** there is no purchase button until F-004.
- **Same-day review dates:** all upstream review dates are the same day, so dates are not shown.

## 4. Deviations from the approved specification

None.

## 5. Documentation updated

- [x] specification.md, intent.md, technical-design.md, test-plan.md
- [x] open-questions (Q4, Q5 corrected, Q15), project-state, project-plan, backlog, conversation logs

## 6. User sign-off (Gate 2)

- [x] Accepted by user — date: 2026-10-06
