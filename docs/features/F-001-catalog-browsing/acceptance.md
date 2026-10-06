# Acceptance

**Feature:** F-001 — Catalog Browsing
**Status:** Accepted (Gate 2, 2026-10-06)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Fresh clone → install, dev → homepage with all categories | Pass | README commands; API seeds from committed snapshot on first start; E2E starts from an empty DB |
| 2 | All 24 categories browsable, incl. vehicle and motorcycle | Pass | `app.test.ts` (24 categories, includes `vehicle`); homepage screenshot |
| 3 | ₹ at 1:1, en-IN grouping, struck-through MRP and discount % | Pass | `money.test.ts`, `mapping.test.ts`, `ProductCard.test.tsx` |
| 4 | Brand + rating filter → correct products, count, chips | Pass | `query.test.ts` (combinations), `ListingPage.test.tsx`, E2E browse flow |
| 5 | URL reproduces products, filters, sort, page | Pass | E2E "shared link"; `listing-params.test.ts` round-trip |
| 6 | Back from page 2 returns to page 1 with same filters | Pass | E2E browse flow |
| 7 | Every sort correct; out-of-stock always last | Pass | `query.test.ts` (each sort); E2E out-of-stock ordering |
| 8 | Out of stock / "Only N left" from application inventory | Pass | `inventory.test.ts`; `app.test.ts` changes the inventory row and checks the API (no raw stock exposed) |
| 9 | Re-running import + seed is identical | Pass | `app.test.ts` seeds twice and compares; `inventory.test.ts` determinism |
| 10 | Empty state names filters and suggests a working removal | Pass, with note | `ListingPage.test.tsx`; `query.test.ts` relaxations. When no *single* removal helps, it says so and makes "Clear all filters" the primary action |
| 11 | API stopped → friendly error + Retry; recovers | Pass | `ListingPage.test.tsx` (no raw text); manual run against the real servers |
| 12 | Bottom sheet below 1024 px; 2/3/4 columns; no horizontal scroll at 360 px | Pass | E2E mobile test (360 px); screenshots at 375 and 1280 px |
| 13 | Keyboard operable; result count announced | Pass | E2E keyboard filter; count in an `aria-live` region; native select and Radix controls |
| 14 | `filter_applied` stored with specified properties | Pass | `ListingPage.test.tsx`; `app.test.ts`; row observed in the E2E database |
| 15 | Card → `/p/:slug` stub; unknown slug → Not found | Pass | E2E. Stub now shows all product images (user feedback, 2026-10-06); `ProductGallery.test.tsx` |
| 16 | Demo notice in footer on every page | Pass | Root layout; screenshots |

## 2. Test results summary

80 unit/API/component tests and 6 E2E tests pass; typecheck clean; production build succeeds. Details in `test-plan.md`.

## 3. Known issues and limitations

- Product images load from the DummyJSON CDN; offline, unseen images show a placeholder.
- Catalog ratings are demo data (covered by the footer notice; reviews labelling comes with F-003).
- Price presets only appear when a round number falls inside the price range (for example, none for Laptops at ₹1,027–₹1,907); custom Min/Max is always available.
- Homepage rails with no cached data show skeletons while offline; the offline banner explains why.
- The web bundle is a single ~500 kB+ chunk (backlog: route-level code-splitting).
- Analytics events queued in the last ~2 s before a hard browser close can be lost; `pagehide` + `sendBeacon` covers normal tab closes.

## 4. Deviations from the approved specification

- **API query format** matches the web URL (`price=min-max`, brand slugs) instead of separate `priceMin`/`priceMax`. Same behaviour, one format to maintain.
- **Product specifications** show warranty and shipping only. DummyJSON's weight and dimensions have no units, so showing them would mean guessing.
- **Store name** "Cartwise" is a placeholder — the brief does not name the store (see decision request below).

None of these change user-facing behaviour defined in the spec.

## 5. Documentation updated

- [x] specification.md
- [x] technical-design.md, test-plan.md
- [x] project-state.md
- [x] project-plan.md
- [x] backlog.md
- [x] ADRs (001, 002 accepted)

## 6. User sign-off (Gate 2)

- [x] Accepted by user — date: 2026-10-06 ("proceed")
