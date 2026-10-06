# Feature Specification

## Feature

**ID:** F-002
**Name:** Search and search history
**Status:** Complete (Gate 1 and Gate 2 approved 2026-10-06)
**Requirements:** SRCH-1..4, HIST-1, STATE-1, ANL-1 (`search_performed`, `search_no_results`)

---

## 1. Objective

Let a shopper who knows roughly what they want type it and get relevant products quickly, tolerating typos and word forms. Make recent searches easy to repeat and remove. Never end in a dead end.

## 2. User Problem

Browsing categories is slow when you already know what you want. Exact keyword matching fails on typos ("iphnoe"), plurals ("shoes" vs "shoe") and words inside compound names ("phone" in "iPhone" or "Smartphones"). Users also repeat searches and should not need to retype them.

## 3. User Intent

"Take me straight to the thing I'm thinking of, even if I type it imperfectly."

## 4. User Stories

- As a guest, I want a search box on every page so I can search from wherever I am.
- As a guest, I want suggestions while typing so I can jump straight to a product or category.
- As a guest, I want typos and plurals to still find the right products.
- As a guest, I want to filter and sort search results the same way as category pages.
- As a guest, I want to see and reuse my recent searches, and remove ones I don't want.
- As a guest, when nothing matches, I want useful alternatives instead of a blank page.

## 5. Functional Requirements

### 5.1 Search box

- FR-1 A search box appears in the header on every page. On desktop (≥ 768 px) it sits inline in the header; on smaller screens it is a full-width row directly under the header.
- FR-2 Submitting (Enter or the search button) opens `/search?q=<query>`. Empty or whitespace-only queries do nothing. Queries are trimmed, inner whitespace is collapsed, and length is capped at 100 characters.
- FR-3 On the results page the box shows the current query, so it can be edited.

### 5.2 Suggestions (SRCH-3)

- FR-4 From 2 characters, after a short pause in typing (about 150 ms), a dropdown shows:
  - up to 3 matching **categories** (opens the category page), and
  - up to 5 matching **products** with thumbnail, title and price (opens the product page),
  - plus a final "Search for '<query>'" row.
- FR-5 With an empty, focused box, the dropdown shows **recent searches** (5.4) instead.
- FR-6 The dropdown follows the WAI-ARIA combobox pattern: ↑/↓ move through options, Enter activates the highlighted option (or submits the typed query if none is highlighted), Escape closes it, and clicking outside closes it.
- FR-7 Suggestions never block typing. If they are slow or fail, the dropdown simply shows the "Search for…" row; submitting still works.

### 5.3 Results (SRCH-1, SRCH-2)

- FR-8 `/search?q=` shows a heading ("Results for 'running shoes'"), the result count, and the same filters, chips, sort, pagination and URL behaviour as F-001 listings. Category becomes a filter here, as on All products.
- FR-9 Default sort is **Relevance**, which is added to the sort options on search results only. The other F-001 sorts are available. Out-of-stock items still come last in every sort.
- FR-10 Matching is deterministic and searches title, brand, category name and tags (strongest) and description (weakest). It tolerates:
  - **typos**: one edit for words of 4–7 letters, two for 8+ ("iphnoe" → iPhone, "lapotp" → laptops);
  - **word forms**: singular/plural ("shoe" ↔ "shoes");
  - **partial words**: the last word as a prefix ("sungl" → sunglasses), and words inside compound names ("phone" → iPhone and Smartphones; "watch" → smartwatch).
- FR-11 Multi-word queries require every meaningful word to match. Common filler words ("for", "the", "a", "with") are ignored.
- FR-12 **Partial match fallback**: if requiring all words returns nothing, results matching *some* of the words are shown under a clear notice: "No results for all of 'red leather office chair'. Showing products that match some of your words."

### 5.4 Search history (HIST-1)

- FR-13 Each submitted search is saved to recent searches on this device: most recent first, duplicates merged case-insensitively, at most 10 kept (oldest dropped). Searches with no results are kept too, so the user can see and retry them.
- FR-14 Recent searches appear in the dropdown when the box is focused and empty. Selecting one repeats the search. Each has a remove (×) button, and there is a "Clear all" action.
- FR-15 For guests, history is stored only in this browser (local storage). It is never sent to the server, except as the query text of analytics events (FR-18). Merging into an account is part of F-006.
- FR-16 If browser storage is unavailable (for example, a private window with storage blocked), search still works and history is simply not kept.

### 5.5 No results (SRCH-4)

- FR-17 When even the partial-match fallback finds nothing:
  - The page says "No results for '<query>'" with tips (check spelling, use fewer or more general words).
  - It shows category tiles so the user can browse instead.
  - It shows the "Top rated" in-stock rail from the homepage.
  - If filters are active and removing one would bring results back, the F-001 relaxation suggestion is shown first.

### 5.6 Analytics

- FR-18 `search_performed` when a search is submitted or repeated from history: `{ query, resultCount, source: 'typed' | 'history' }`. `search_no_results` additionally when `resultCount` is 0: `{ query }`. `resultCount` comes from the first results response, so the events fire after it arrives. Selecting a product or category suggestion is navigation, not a search, and fires neither.

## 6. Non-Functional Requirements

- Performance: suggestions respond in under 50 ms locally and search results in under 150 ms. The index is built once at API start and rebuilt when the catalog is re-seeded.
- Accessibility: combobox ARIA pattern (role, `aria-expanded`, `aria-activedescendant`, listbox options); the result count is announced; remove buttons have labels ("Remove 'running shoes' from recent searches").
- Responsiveness: the dropdown is full width under the box on mobile; no horizontal scroll at 360 px.
- Privacy: history stays on the device. Analytics query text is capped at 100 characters and linked only to the anonymous visitor id.
- Security: the query is validated and length-capped server-side and never interpreted as code. Results render as text (no HTML injection).

## 7. UX Requirements

- Primary action: type and press Enter. Suggestions are a shortcut, never a requirement.
- Progressive disclosure: recent searches show only on an empty, focused box; suggestions only while typing.
- No authentication.
- Feedback: the dropdown appears quickly, and the highlighted option is clearly visible.
- No dead ends (FR-12, FR-17).

## 8. UI Requirements

- **Screens:** Search results (`/search`) and its no-results state.
- **Components:**
  - Header: SearchBox (combobox), SuggestionList, RecentSearchList.
  - Results page: PartialMatchNotice, NoSearchResults.
- **States:**
  - Dropdown: loading, suggestions, no suggestions, recent searches, nothing to show (closed).
  - Results page: F-001 states, plus partial match and no results.
- **Responsive:** inline box on desktop; full-width row under the header on mobile.

## 9. Data Requirements

| Entity | Fields | Owner | Persistence |
|---|---|---|---|
| Search index | per product: title, brand, category name, tags, description | Application (derived from the catalog) | In memory, rebuilt from the database |
| Recent search (guest) | query, searchedAt | User's browser | `localStorage`, max 10 |
| Analytics events | as F-001 | Application | `analytics_events` |

## 10. API Requirements

| Endpoint | Purpose | Response |
|---|---|---|
| `GET /api/products?q=…` | Search results. `q` joins the existing listing parameters; `sort=relevance` is valid when `q` is present and is its default | F-001 `ListingResponse` plus `search: { query, matchMode: 'all' \| 'partial' }` |
| `GET /api/search/suggestions?q=…` | Typeahead | `{ categories: { slug, name }[], products: ProductSummary[] }` (max 3 and 5) |

`q` is trimmed and capped at 100 characters; a blank `q` behaves as no search. Errors use the F-001 envelope.

## 11. State Management

- URL: `q` joins the listing query string (single source of truth for results).
- Server state: TanStack Query for results (keeping previous data) and for suggestions (keyed by debounced query, short cache).
- Local state: input text, dropdown open/closed, highlighted option.
- Persistent client state: recent searches in `localStorage` behind a small store, so the header and any other view stay in sync.

## 12. Loading States

- Suggestions: a subtle inline spinner in the dropdown; the previous suggestions stay visible while new ones load.
- Results: F-001 behaviour (skeletons on first load, then dimmed previous results while updating).

## 13. Empty States

- Results: FR-12 partial match, then FR-17 no results.
- Dropdown with an empty box and no history: the dropdown does not open.

## 14. Error States

- Suggestions failing: silently show only "Search for…" (FR-7).
- Results failing: F-001 error state with Retry.
- Offline: F-001 banner and offline state. Recent searches still show, because they are local.

## 15. Security Considerations

Server-side validation and length caps on `q`. Query text is rendered as text only. History is never stored server-side for guests.

## 16. Analytics

`search_performed`, `search_no_results` (FR-18).

## 17. Acceptance Criteria

1. The search box is visible on every page: inline on desktop, under the header on mobile (360 px, no horizontal scroll).
2. Typing "lap" shows the Laptops category and laptop products as suggestions; ↓ then Enter opens the highlighted suggestion; Escape closes the dropdown.
3. Submitting "laptop" opens `/search?q=laptop` and shows the Laptops products, sorted by Relevance.
4. Typos still find products: "iphnoe" returns iPhones and "lapotp" returns laptops.
5. "shoe" and "shoes" return the same products, and "phone" returns iPhones and smartphones.
6. A query like "nike shoes" requires both words. "red leather office chair" shows the partial-match notice with products matching some words, rather than nothing.
7. A nonsense query ("qwxzv") shows "No results for 'qwxzv'", tips, category tiles and the Top rated rail.
8. Search results can be filtered, sorted and paginated, and the URL (including `q`) reproduces the view on reload, on Back, and in a new tab.
9. After searching, focusing the empty box shows recent searches newest first, at most 10, with no case-insensitive duplicates. Selecting one repeats it; × removes one; Clear all empties the list; the list survives a reload.
10. With `localStorage` blocked, search still works and no error is shown.
11. `search_performed` (with `source`) and `search_no_results` are stored with the specified properties; selecting a suggestion stores neither.
12. Suggestions failing or the API being down do not block typing or submitting; results show the F-001 error state with Retry.
13. The whole flow works by keyboard alone, and screen readers announce the combobox, the options and the result count.

## 18. Testing Strategy

- **Unit** (api): tokenisation, filler-word removal, plural normalisation, typo tolerance by word length, compound-word matching, all-words vs partial fallback, relevance order, suggestion caps.
- **Unit** (web): recent-search store (order, dedupe, cap of 10, remove, clear, storage unavailable).
- **API:** `q` combined with filters/sort/pagination, `relevance` sort validity, suggestions endpoint, length cap.
- **Component:** SearchBox keyboard and mouse interaction, recent-search interactions, PartialMatchNotice, NoSearchResults, the analytics events.
- **E2E:** type → suggestion → product; submit → filter → Back; typo query; no results; history across reload; mobile layout.

## 19. Dependencies

- F-001 (listing, filters, states, analytics pipeline) — complete.
- A small client-side search library on the server, or hand-written matching — an implementation choice, recorded in the technical design.

## 20. Out of Scope

- Natural-language and semantic search ("headphones for a noisy office under ₹10,000"), including parsing prices or intent from the query — Phase 3 AI.
- Search history stored on the server or merged into an account — F-006.
- Searching within a single category from a category page.
- Spelling "did you mean" prompts (typo tolerance covers most cases).
- Trending or popular searches (no real behavioural data yet).
- Personalised ranking.

## 21. Assumptions

- The catalog stays at around 200 products, so an in-memory index in the API process is enough.
- Guest search history is per browser, not per person.
- Analytics may store query text (capped, anonymous). Users are not separately notified beyond the demo notice.

## 22. Decisions Required From User

None. The UX choices that shape behaviour are listed in `intent.md` §3 for approval.
