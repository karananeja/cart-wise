# Test Plan

**Feature:** F-002 — Search and search history

## 1. Scope

Term processing, matching, ranking and fallback; the `q` parameter in the listing contract; the suggestions endpoint; recent-search store; search box interaction; search results states; analytics events; the end-to-end search flow.

## 2. Risk areas

- Typo tolerance too loose (irrelevant results) or too strict (AC4)
- Compound-word fragments producing noise
- Relevance sort vs out-of-stock ordering
- Combobox keyboard behaviour and focus handling
- Duplicate analytics events on Back or reload
- History bounds and storage failure

## 3. Tests

| Level | Area | Cases | File |
|---|---|---|---|
| Unit | api: terms | normalisation, filler words, stemming, fragments | `apps/api/src/search/terms.test.ts` |
| Unit | api: search index | typos incl. transpositions, plurals, prefix, compound, AND vs partial, ranking, suggestions | `apps/api/src/search/searchIndex.test.ts` |
| Unit | shared | `q` parsing and cap, relevance default and validity | `packages/shared/src/listing-params.test.ts` |
| API | routes | `q` with filters/sort/pagination, `search` field, suggestions, length cap | `apps/api/src/app.test.ts` |
| Unit | web: recent searches | order, dedupe, cap, remove, clear, storage unavailable | `apps/web/src/lib/recentSearches.test.ts` |
| Component | SearchBox | suggestions, keyboard navigation, Escape, submit, recent searches, remove/clear | `apps/web/src/features/search/SearchBox.test.tsx` |
| Component | Search results | heading, partial notice, no results, analytics events (no duplicates) | `apps/web/src/features/search/SearchResults.test.tsx` |
| E2E | search flow | suggestion → product; submit → filter → Back; typo; no results; history across reload; mobile layout | `e2e/search.spec.ts` |

## 4. Manual verification

Screenshots of the dropdown, results, partial and no-results states at 1280 and 375 px.

## 5. Results

| Run date | Command | Result | Notes |
|---|---|---|---|
| 2026-10-06 | `pnpm test` | 140 passed (shared 16, api 77, web 47) | |
| 2026-10-06 | `pnpm e2e --repeat-each=3 --workers=2` | 36 passed (12 tests × 3) | F-001 and F-002 suites; no flakes |
| 2026-10-06 | `pnpm typecheck`, `pnpm build` | Clean / succeeds | Bundle-size warning as in F-001 (backlog) |
| 2026-10-06 | Manual (Playwright-driven screenshots) | Pass | Suggestions, results, partial, no results (1280 px); recent searches and suggestions (375 px); no console errors |

### Defects found and fixed during testing

- Search ids: MiniSearch returned product ids as strings, so every search would have matched nothing in the listing. Found by probing against the real catalog; ids are now converted to numbers, and searches are covered by tests against the real catalog.
- Navigation race: clearing the "this search was submitted" marker with a router navigation could land after the user's next search and send them back to the previous results. Found by repeated E2E runs. Replaced with a per-session record plus a direct history-entry update (no navigation).
- Typing overwritten: syncing the box from the URL could overwrite text typed immediately after a submit. The box now syncs only while it is not focused.
- Test-only: E2E reads before results settled, an ambiguous "Men's Shoes" locator (category vs product name), and sort `<option>`s matched by a broad query.
