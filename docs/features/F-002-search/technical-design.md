# Technical Design — F-002 Search and search history

**Status:** Implementation
**Inputs:** specification.md (approved), F-001 technical design, ADR-001/002

## 1. Search engine

MiniSearch (MIT, about 7 kB, no native code), used in the API process. It provides an inverted index, per-field boosts, prefix and Levenshtein-fuzzy matching, AND/OR query trees and custom term processing. Writing this by hand would duplicate a well-tested library. Alternatives rejected: SQLite FTS5 (no fuzzy matching, so we would still need our own typo handling) and searching in the browser (couples the frontend to catalog internals, against ADR-002).

### Index

One document per product:

| Field | Boost | Content |
|---|---|---|
| title | 5 | product title |
| brand | 4 | brand |
| category | 4 | category name and slug words |
| tags | 3 | tags |
| description | 1 | description |
| fragments | 1 | suffixes (≥ 4 letters) of every title/brand/category/tag word, after stemming |

Term processing (index and query): Unicode-normalise, lowercase, drop words shorter than 2 letters and filler words, then light plural stemming (`-ies → -y`, `-es` after s/x/z/ch/sh, otherwise trailing `-s` unless `-ss/-us/-is`). The `fragments` field makes "phone" match "smartphone" and "watch" match "smartwatch" (spec FR-10) at a lower weight than a whole-word match.

### Query

For each meaningful query word, build an OR group:

- the word itself, fuzzy up to 1 edit (4–7 letters) or 2 edits (8+), prefix-matched only for the last word;
- each adjacent-letter transposition of the word, exact. MiniSearch fuzzy matching is Levenshtein, where a swap ("iphnoe") costs 2 edits; spec FR-10 treats it as a single typo.

The groups are combined with AND. If that returns nothing, the same groups are combined with OR and the response is marked `matchMode: 'partial'` (FR-12).

The index is built when the app is created (the database is seeded first) and holds only ids. Prices and inventory are joined at query time, so availability is always current.

### Listing integration

`queryCatalog` gains an optional `relevance: Map<productId, score>`. When present, items are restricted to the matches before filtering and faceting, and the `relevance` sort orders by score (available first, as always).

## 2. Shared contract

- `ListingParams.q?: string` — trimmed, whitespace collapsed, at most 100 characters; blank means absent.
- `SORT_OPTIONS` adds `relevance`. It is valid only when `q` is present, and is then the default; otherwise `featured` is the default.
- `ListingResponse.search?: { query, matchMode: 'all' | 'partial' }`.
- `SearchSuggestions = { categories: { slug, name }[], products: ProductSummary[] }`.

## 3. API

- `GET /api/products?q=…` — as F-001, with search applied.
- `GET /api/search/suggestions?q=…` — products: AND query with prefix, top 5 (available first, then score). Categories: a small separate MiniSearch index over category names with the same processing, top 3. Fewer than 2 characters returns empty lists.

## 4. Web

- **Route:** `/search` renders the listing page in search mode (heading "Results for '…'", breadcrumb Home › Search, partial-match notice, no-results state). `/search` without `q` redirects to `/products`.
- **SearchBox:** one instance in the header (CSS ordering places it inline on ≥ md and as a full-width row below on mobile, so there are no duplicate ids). It is a hand-built WAI-ARIA 1.2 combobox: input `role=combobox`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; listbox with options, grouped under labels. Shift+Delete removes the highlighted recent search, and each recent search also has a pointer-only remove button. "Clear all" is a normal button.
- **Debounce:** 150 ms before querying suggestions; previous suggestions stay visible while new ones load.
- **Recent searches:** a module store (`useSyncExternalStore`) over `localStorage` key `store.recentSearches`; max 10, case-insensitive dedupe, newest first. If storage throws, an in-memory list is used for the session only.
- **Analytics:** submitting navigates with history state `{ searchSource }`. When the results page receives non-placeholder data for that navigation it fires `search_performed` (and `search_no_results` when `total` is 0), then clears the history state with a `replace` navigation, so Back or reload does not re-fire.
