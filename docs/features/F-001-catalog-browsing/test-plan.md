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
| Component | Listing page | filter → chips + URL, clear all, empty state suggestion, error + retry, invalid params normalised | `apps/web/src/features/catalog/pages/ListingPage.test.tsx` |
| E2E | browse flow | home → category → brand + rating filter → sort → page 2 → Back; deep link; mobile filter sheet | `e2e/browse.spec.ts` |

## 4. Manual verification

- Responsive layout at 360 / 768 / 1280 px
- Keyboard-only pass over header, filters, sort, pagination
- API stopped → error state; restarted → Retry recovers

## 5. Results

| Run date | Command | Result | Notes |
|---|---|---|---|
