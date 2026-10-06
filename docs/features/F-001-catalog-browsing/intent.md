# Feature Intent

**Feature:** F-001 — Catalog Browsing
**Status:** Awaiting Approval
**Approved by / date:** —

---

## 1. In one sentence

A guest opens the store, picks a category or "All products", and narrows to a handful of worth-looking-at products using a few clear filters and sorts — with honest prices and availability, and nothing asking them to sign up.

## 2. Intended behavior

- The homepage shows every category as a visual tile, plus "Top rated" and "Biggest discounts" rails.
- A category page shows a grid of product cards: image, title, brand, ₹ price, struck-through original price and discount when there is one, rating, and a stock badge only when stock is low or zero.
- Filters: price, brand, rating, in-stock-only (and category on "All products"). Sort: Featured, price up/down, rating, discount.
- Active filters show as chips you can remove one by one. The URL always reflects what you see, so Back, reload and shared links just work.
- If nothing matches, the page tells you which filter to drop to get results back, instead of a dead end.
- While loading you see skeletons on first load, and on later changes the current results stay on screen (dimmed) until the new ones arrive. Errors and offline states say what happened in plain language and offer Retry.
- Clicking a card opens a simple product view (full product page arrives in F-003).
- Every page carries a quiet footer notice that this is a demo store with simulated data.

Behind the scenes: the project scaffold, the application API, the imported catalog snapshot, separate application-owned inventory, and the analytics pipeline (`filter_applied`) are built here and reused by every later feature.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| Numbered pagination (24/page), not infinite scroll | Keeps Back/position predictable, footer reachable, URL shareable |
| Out-of-stock items shown but always sorted last | Honest about range without cluttering the top of results |
| "Only N left" only at ≤ 5 real units | Real inventory signal, never fake urgency |
| No "Trending" / "Popular" rail yet | No real behavioural data exists; avoids fabricated social proof |
| Zero-result filter options disabled, not hidden | User understands why an option can't be chosen |
| Mobile filters in a bottom sheet with "Show N results" | One decision at a time, no reload per tap |
| No search box, cart or account icons until those features exist | No non-working UI |

## 4. What this feature deliberately does not do

Search, full product page, reviews, variants, cart, wishlist, sign-in, recently viewed, recommendations, AI, inventory changes after seeding.

## 5. How we will know it works

Acceptance criteria 1–16 in `specification.md` §17, verified by unit, API, component and E2E tests plus a manual responsive and keyboard pass.

## 6. Decisions needed before implementation

- Q1 Architecture (recommend React SPA + Fastify API + SQLite)
- Q2 Currency (recommend INR at fixed ₹85/$)
- Q3 Categories (recommend excluding vehicle and motorcycle)

## 7. Approval

- [ ] Approved for implementation (Gate 1)
