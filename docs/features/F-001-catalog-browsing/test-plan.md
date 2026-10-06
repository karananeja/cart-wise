# Test Plan

**Feature:** F-001 — Catalog Browsing

## 1. Scope

Catalog import mapping, inventory seeding and availability, the listing query (filters, facets, sort, pagination, relaxations), the HTTP API, URL-state handling, product card and listing UI states, and the main browse flow end to end. Out of scope: visual polish (manual), DummyJSON availability.

## 2. Risk areas

- Faceting correctness (counts must exclude their own filter)
- Out-of-stock ordering under every sort
- URL ↔ state round-trip, Back button, invalid params
- Price conversion and formatting
- Availability derived from application inventory, not DummyJSON
- Seed determinism

## 3. Tests

| Level | Area | Cases | File |
|---|---|---|---|
| Unit | shared: params | parse valid/invalid/partial, serialise canonical, round-trip | `packages/shared/src/listing-params.test.ts` |
| Unit | shared: money | whole rupees, paise, en-IN grouping | `packages/shared/src/money.test.ts` |
| Unit | api: mapping | price conversion, discount, slug collisions, category names | `apps/api/src/catalog/mapping.test.ts` |
| Unit | api: inventory | determinism, distribution includes 0 and 1–5, availability thresholds | `apps/api/src/inventory/inventory.test.ts` |
| Unit | api: query | each filter, combinations, disjunctive facets, every sort with OOS last, pagination clamp, relaxations | `apps/api/src/catalog/query.test.ts` |
| API | routes | categories, listing with params, 404 category/product, events validation, no raw stock exposed | `apps/api/src/app.test.ts` |
| Component | ProductCard | discount/no discount, low stock, out of stock, image fallback | `apps/web/src/features/catalog/components/ProductCard.test.tsx` |
| Unit | web: helpers | price presets, price labels, pagination window | `apps/web/src/features/catalog/filterLabels.test.ts` |
| Component | Listing page | filter → chips + URL, clear all, empty state suggestion, error + retry, invalid params normalised | `apps/web/src/features/catalog/pages/ListingPage.test.tsx` |
| E2E | browse flow | home → category → brand filter → sort → page 2 → Back; deep link; out-of-stock last; card → product page; unknown product; keyboard filter; mobile sheet at 360 px with no horizontal scroll | `e2e/browse.spec.ts` |

## 4. Manual verification

- Responsive layout at 360 / 768 / 1280 px
- Keyboard-only pass over header, filters, sort, pagination
- API stopped → error state; restarted → Retry recovers

## 5. Results

| Run date | Command | Result | Notes |
|---|---|---|---|
| 2026-10-06 | `pnpm test` | 78 passed (shared 13, api 45, web 20) | |
| 2026-10-06 | `pnpm e2e` | 6 passed | Chromium; own API (port 3101, fresh DB) and web server (5174) |
| 2026-10-06 | `pnpm typecheck` | Clean | |
| 2026-10-06 | `pnpm build` | Succeeds | Vite warns that the main chunk exceeds 500 kB (backlog: route code-splitting) |
| 2026-10-06 | Manual (Playwright-driven) | Pass | Offline banner with cached results; API stopped → friendly error, no raw text; restart + Try again recovers; screenshots reviewed at 1280 and 375 px |

### Defects found and fixed during testing

- Duplicate control ids: the filter panel renders in both the (CSS-hidden) desktop sidebar and the mobile sheet, so labels pointed at the hidden copy and sheet controls had no accessible name. Fixed by prefixing ids per panel instance. Found by E2E.
- Mobile "Filters" button announced its count poorly; now has an explicit accessible name ("Filters, 1 active").
- MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`; the old option was silently ignored, so unhandled requests would not have failed tests. Fixed.
- E2E race: reading cards before pagination finished. Test now waits for the page to settle.
- On "All products" with filters, the collapsed category list could show only disabled zero-count rows; categories with matches are now listed first.
