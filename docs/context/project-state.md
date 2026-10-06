# Project State Checkpoint

**Last updated:** 2026-10-06

## Current phase

Phase 1 — MVP.

## Current feature

**F-010 Orders — Gate 1 approved 2026-10-06; in implementation.** F-001 to F-009 complete (accepted 2026-10-06). F-001 to F-008 complete (accepted 2026-10-06). F-001 to F-007 complete (accepted 2026-10-06). F-001 to F-006 complete (accepted 2026-10-06). F-001 to F-005 complete (accepted 2026-10-06).

## Completed

- Phase 0 discovery and documentation.
- User decisions (2026-10-06): Q1 React + Tailwind + shadcn/ui, Node.js Express API, pnpm workspace; Q2 ₹ at 1:1 with USD; Q3 all 24 categories. F-001 Gate 1 approved.
- ADR-001 and ADR-002 accepted.
- F-001 built: workspace, shared package, Express API (SQLite via better-sqlite3), committed DummyJSON snapshot + deterministic inventory seed, homepage, listing pages with filters/sort/pagination/URL state, product page stub, analytics pipeline (`filter_applied`), loading/empty/error/offline states.

- Gallery added to the product page stub after user feedback (2026-10-06).

## In progress

None.

## Remaining

F-002 → F-011 per `project-plan.md`, then Phase 2 and optional AI.

## Approved requirements / intents

- F-001 specification and intent (Gate 1, 2026-10-06); F-001 accepted (Gate 2, 2026-10-06).
- F-002 specification and intent (Gate 1, 2026-10-06); F-002 accepted (Gate 2, 2026-10-06).
- F-003 specification and intent (Gate 1, 2026-10-06), size sets as proposed; F-003 accepted (Gate 2, 2026-10-06).

## Architecture decisions

ADR-001 (architecture, accepted), ADR-002 (catalog snapshot + application inventory, accepted), ADR-003 (sessions, scrypt, simulated OTP, JSON-only POST guard, accepted), ADR-004 (Leaflet + OSM tiles + Nominatim via API proxy, accepted). F-003: inventory is per sellable unit (size or product); schema version 2 with automatic rebuild of seeded tables.

## Relevant files

- `apps/api/src/catalog/query.ts` — listing query (filters, disjunctive facets, sort, pagination, relaxations)
- `apps/api/src/inventory/inventory.ts` — seeded stock and availability rules (low stock ≤ 5)
- `apps/api/src/catalog/config.ts` — USD→INR rate (1)
- `packages/shared/src/listing-params.ts` — URL/API query contract
- `apps/web/src/features/catalog/` — pages, components, hooks
- `apps/web/src/lib/analytics.ts` — event client
- `apps/api/src/search/` — search index (MiniSearch + term processing, swapped-letter variants)
- `apps/api/src/inventory/sizes.ts` — size sets; `apps/web/src/lib/localList.ts` — bounded local lists (recent searches, recently viewed)
- `apps/api/src/cart/` — cart rules, service (cookie identity, limits, expiry), routes; `apps/web/src/features/cart/` — Add to cart, cart page, hooks
- `apps/api/src/wishlist/`, `apps/web/src/features/wishlist/` — wishlist API, hearts, page, size picker; `apps/api/src/http/cookies.ts` — guest cookies
- `apps/api/src/auth/` (validation, passwords, otp, sessions, rateLimit, merge, routes), `apps/api/src/http/owner.ts` (user/guest owner), `apps/web/src/features/auth/`
- `apps/api/src/addresses/`, `apps/api/src/geo/` (Nominatim proxy), `apps/web/src/features/addresses/` (LocationPicker, lazy MapView)
- `apps/api/src/orders/` (quote, atomic holds, expiry sweep), `apps/web/src/features/checkout/` (CheckoutPage, PaymentPage, HoldCountdown)
- `packages/shared/src/payment.ts` (offers, card ranges, outcome rule, UPI), `apps/api/src/payments/` (attempts, OTP, completion), `apps/api/src/analytics/record.ts` (server events), `apps/web/src/features/payment/`, `apps/web/src/features/orders/ConfirmationPage.tsx`
- `apps/web/src/features/search/SearchBox.tsx` — header combobox; `apps/web/src/lib/recentSearches.ts` — history store

## Tests

- `pnpm test`: 349 passing (shared 35, api 188, web 126). `pnpm e2e`: 39 passing (stable over 3 repeats). Typecheck clean. Build succeeds.
- No failing tests.

## Known bugs / limitations

See `features/F-001-catalog-browsing/acceptance.md` §3. No known bugs.

## Working rules

- The user runs `pnpm dev` (5173/3001, `store.db`) in their own terminal. Never stop it. Manual checks run on 5274/3201 with `preview.db`; E2E on 5174/3101 with `e2e.db`. Stop only those ports.

## Pending questions for the user

- Currency corrected to ₹96 = $1 (2026-10-06); card offers (PAY-5, fictional banks) and simulated UPI (PAY-6) added to F-009.

- Store name: "Cartwise" kept as placeholder (user did not address it).
- Q4 (add sizes), Q5 (show reviews, unlabelled — corrected after a misread), Q15 (rating = review average) resolved. Q6–Q14 open for later features.

## Rejected approaches

- Fastify (user chose Express). Drizzle ORM and `node:sqlite` (plain SQL with better-sqlite3 instead; see ADR-001).
- Proxying DummyJSON live (ADR-002).

## User sign-offs

- Gate 1 F-001: 2026-10-06.
- Gate 2 F-001: 2026-10-06 ("proceed").
- Gate 1 F-002: 2026-10-06.
- Gate 2 F-002: 2026-10-06.
- Gate 1 F-003: 2026-10-06.
- Gate 2 F-003: 2026-10-06.
- Gate 1 F-004: 2026-10-06 (10 per line, 30-day carts; Go to cart later changed to an in-place stepper).
- Gate 2 F-004: 2026-10-06.
- Gate 1 F-005: 2026-10-06 (product-level, 100 items, 90 days, hearts on cards).
- Gate 2 F-005: 2026-10-06.
- Gate 1 F-006: 2026-10-06 (OTP-default sign-in + password alternative; code rules; sign-out → empty guest). ADR-003 accepted.
- Gate 2 F-006: 2026-10-06.
- Gate 1 F-007: 2026-10-06; Gate 2 F-007: 2026-10-06. ADR-004 accepted.
- Gate 1 F-008: 2026-10-06; Gate 2 F-008: 2026-10-06.
- Gate 1 F-009: 2026-10-06 (customer-chosen offer, any Luhn-valid card with first 6/last 4 only, bank OTP, in-page demo UPI app); Gate 2 F-009: 2026-10-06.
- Gate 1 F-010: 2026-10-06 (order simulation in F-010; demo operator password; delivery charge not refunded on returns).

## Exact next action

Implement F-010 per `docs/features/F-010-orders/technical-design.md`: shared `orders.ts` (done) → API lifecycle + sim operator → web orders pages + `/sim/orders` → tests → E2E → acceptance.md → Gate 2.
