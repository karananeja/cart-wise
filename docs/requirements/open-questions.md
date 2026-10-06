# Open Questions, Gaps and Ambiguities

Status: **Open** / **Resolved** (with date and decision). "Blocks" names the first feature that cannot proceed without an answer.

## Resolved for F-001

### Q1 — Application architecture (Resolved 2026-10-06)

**Decision (user):** React + Tailwind CSS + shadcn/ui frontend, Node.js **Express** API, pnpm workspace. See ADR-001 (Accepted).


The brief prefers React frontend + own backend/API with application-owned state, simplified where appropriate.

| Option | Summary | Trade-off |
|---|---|---|
| **A. React SPA + small Node API + SQLite** (recommended) | Vite/React/TypeScript web app; Fastify API; SQLite file database; pnpm workspace; one `pnpm dev` starts both | Matches brief §22 exactly; real auth, server-side inventory and simulation timers; a little more setup |
| B. React SPA + in-browser mock backend (MSW + IndexedDB) | No server process | Simplest to run, but "application-owned" data lives in each browser; auth and inventory are fictional; multi-tab and simulation console become awkward |
| C. Next.js full-stack | One framework for UI and API | Blurs the frontend/backend boundary the brief wants to demonstrate; heavier framework conventions |

Details: `decisions/ADR-001-application-architecture.md` (Proposed).

### Q2 — Currency and pricing (Resolved 2026-10-06)

**Decision (user):** Display ₹ with a 1:1 rate for now ($1 → ₹1). The rate is a single configuration constant so it can change later.


The brief uses ₹ (e.g. "under ₹10,000", `amount=1299`). DummyJSON prices are in USD (e.g. 9.99).

Recommendation: display INR. Convert at a fixed, documented rate during catalog import (default ₹85 = $1), store prices as integer paise, round to whole rupees, format with Indian digit grouping (₹1,29,999).

### Q3 — Catalog category scope (Resolved 2026-10-06)

**Decision (user):** Import all 24 categories, including `vehicle` and `motorcycle`.


DummyJSON has 194 products in 24 categories, including `vehicle` and `motorcycle` (cars and motorbikes at $10k–$100k+), which do not fit a consumer store and break price filters and delivery assumptions.

Recommendation: import all categories except `vehicle` and `motorcycle` (~184 products).

## Needed before later features (not blocking now)

| # | Question | Blocks | Recommendation |
|---|---|---|---|
| Q4 | **Resolved 2026-10-06 (user): add app-owned sizes** for apparel and footwear. | F-003 | Size sets proposed in F-003 spec |
| Q5 | **Resolved 2026-10-06 (user, corrected): show DummyJSON reviews without a per-review "demo" label.** The site-wide footer notice ("ratings, reviews … are simulated") satisfies brief §18. Reviewer emails are not shown. | F-003 | — |
| Q15 | **Resolved 2026-10-06 (user):** star rating = average of the product's reviews (DummyJSON's own `rating` contradicted its reviews for 73 of 194 products). | F-003 | Changes star values, rating filter counts and Top rated order from F-001 |
| Q6 | Store Simulation Console is in brief §16 but not in the MVP priority list. Include in MVP? | F-010 | Yes — without it the order lifecycle cannot be demonstrated |
| Q7 | Map-assisted address entry: which provider? | F-007 | Manual form first; map via OpenStreetMap + Leaflet + Nominatim (free, no key) — Google Maps needs a billing account |
| Q8 | Delivery options and pricing (e.g. Standard free over ₹X, Express ₹Y) | F-008 | Propose concrete rules in F-008 spec |
| Q9 | Cancellation / return / refund rules (which states allow which action, refund timing) | F-010 | Cancel before Shipped; return within N days of Delivered; simulated instant refund |
| Q10 | Inventory reservation: when reserved, how long held | F-008 | Reserve at payment start, hold 10 minutes, release on failure/expiry |
| Q11 | Taxes: tax-inclusive prices (Indian MRP convention) with GST shown informationally, or tax added at checkout? | F-008 | Tax-inclusive |
| Q12 | Guest/account merge conflict rules (cart quantity when same item in both) | F-006 | Take the larger quantity, capped by stock |
| Q13 | Account verification (email/mobile OTP), password reset | F-006 | None in MVP; simulated reset in backlog |
| Q16 | Delivery OTP details: when the code is generated (on Out for Delivery), where the customer sees it (order page and order list), length (4 digits), wrong-code behaviour (message + limited attempts), regeneration | F-010 / F-011 | Generate a 4-digit code on Out for Delivery; show it on the order page; 3 wrong attempts lock delivery for that attempt until a new code is issued; confirm in F-010 spec |
| Q14 | Simulation console access control | F-011 | Local demo route with a visible "Demo operator" label, no separate admin auth |

## Observations about the inputs

- DummyJSON `stock`, `availabilityStatus` and `minimumOrderQuantity` (e.g. 48 for a mascara) are ignored. Inventory is seeded by the application (INV-1).
- DummyJSON product `rating` does not correspond to its 3 reviews. Ratings will be shown as catalog data and treated as demo data (NFR-8).
- Product images are served from `cdn.dummyjson.com`; offline viewing needs a placeholder fallback.
- The repository was not a Git repository at discovery time.
- The original template `docs/feeature-specification.md` was moved to `docs/templates/specification.md`.
