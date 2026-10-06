# Acceptance

**Feature:** F-002 — Search and search history
**Status:** Pending user sign-off (Gate 2)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Search box on every page; inline on desktop, own row on mobile; no horizontal scroll at 360 px | Pass | Root header; E2E mobile test (width > 300 px, scrollWidth ≤ 360); screenshots |
| 2 | "lap" suggests Laptops + laptops; ↓/Enter opens; Escape closes | Pass | `SearchBox.test.tsx`; E2E suggestions test |
| 3 | "laptop" → `/search?q=laptop`, Laptops products, Relevance sort | Pass | E2E results test (5 products, sort = relevance) |
| 4 | Typos "iphnoe", "lapotp" | Pass | `searchIndex.test.ts` (real catalog); E2E typo test |
| 5 | "shoe" = "shoes"; "phone" → iPhones and smartphones | Pass | `searchIndex.test.ts` (all 16 smartphones); E2E |
| 6 | "nike shoes" requires both; "red leather office chair" partial notice | Pass | `searchIndex.test.ts`; `app.test.ts`; E2E |
| 7 | "qwxzv" → no results, tips, categories, Top rated | Pass | `SearchResults.test.tsx`; E2E |
| 8 | Filter/sort/paginate; URL with `q` survives reload, Back, new tab | Pass | `app.test.ts` (q + filters + sort + page); E2E results test |
| 9 | Recent searches: newest first, ≤ 10, deduped, repeat, remove, clear, survives reload | Pass | `recentSearches.test.ts`; `SearchBox.test.tsx`; E2E reload test |
| 10 | Storage blocked → search still works, no error | Pass | `recentSearches.test.ts` (throwing storage) |
| 11 | `search_performed` (with source) and `search_no_results`; none for suggestion clicks; no double count on Back | Pass | `SearchResults.test.tsx` |
| 12 | Suggestions/API failure never block searching; results show F-001 error state | Pass | `SearchBox.test.tsx` (suggestions 500); F-001 error tests apply to results |
| 13 | Keyboard-only flow; combobox, options and count announced | Pass | Combobox ARIA attributes asserted in tests; E2E uses keyboard for suggestions and submit |

## 2. Test results summary

140 unit/API/component tests; 12 E2E tests passing on 3 repeated runs; typecheck clean; build succeeds. Details in `test-plan.md`.

## 3. Known issues and limitations

- Matching inside compound words can add loosely related results at the bottom (e.g. "sungl" also lists a Samsung phone). They rank below real matches.
- Ranking is lexical. There is no popularity or personalisation signal (no real behavioural data yet).
- Recent searches are per browser; account sync arrives with F-006.
- Natural-language constraints ("under ₹10,000") are not interpreted (Phase 3 AI, by design).

## 4. Deviations from the approved specification

None in behaviour. Implementation choices are recorded in `technical-design.md` (MiniSearch plus swapped-letter variants).

## 5. Documentation updated

- [x] specification.md, technical-design.md, test-plan.md
- [x] project-state.md, project-plan.md, conversation logs

## 6. User sign-off (Gate 2)

- [ ] Accepted by user — date:
