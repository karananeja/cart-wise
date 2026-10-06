# Feature Intent

**Feature:** F-002 — Search and search history
**Status:** Approved
**Approved by / date:** User, 2026-10-06

---

## 1. In one sentence

From any page, a shopper types what they want, even misspelled, and gets relevant products. Suggestions appear as they type, recent searches are one tap away, and there is always somewhere useful to go next.

## 2. Intended behavior

- A search box sits in the header (a full-width row on phones).
- Typing "lap" shows matching categories and a few products with thumbnails and prices; arrow keys and Enter work.
- Pressing Enter opens a results page that works exactly like a category page: filters, chips, sort, pagination, shareable URL. It is sorted by Relevance by default.
- Typos and word forms are forgiven: "iphnoe", "lapotp", "shoe"/"shoes", and "phone" finding iPhones and smartphones.
- If no product matches every word, you see products matching some of your words, with a clear notice. If nothing matches at all, you get tips, category tiles and top-rated products rather than a blank page.
- Clicking into an empty search box shows your last 10 searches on this device. You can repeat one, remove one, or clear them all. Nothing about your history leaves the browser (except the anonymous search analytics).

## 3. Key UX choices

| Choice | Reason |
|---|---|
| Mobile search is an always-visible row under the header, not an icon | Search is a primary entry point; one tap less |
| Suggestions = up to 3 categories + 5 products, plus "Search for '…'" | Rich enough to jump straight in, short enough to scan |
| All words must match; if nothing does, fall back to some words with a notice | Precise by default, never a dead end |
| Relevance is the default sort, and only on search results | Elsewhere there is no query to be relevant to |
| History is per device, max 10, failed searches kept | Bounded (brief §9/§10), and lets users retry a failed search |
| No "did you mean" prompt | Typo tolerance already returns the right products |
| Natural-language queries are not interpreted ("under ₹10,000") | That is the optional AI phase; kept separate per the brief |

## 4. What this feature deliberately does not do

Semantic or AI search, parsing prices from the query, server-side or account history (F-006), in-category search, trending searches, personalised ranking.

## 5. How we will know it works

Acceptance criteria 1–13 in `specification.md` §17, verified by unit, API, component and E2E tests.

## 6. Decisions needed before implementation

None beyond approving this intent.

## 7. Approval

- [x] Approved for implementation (Gate 1) — 2026-10-06
