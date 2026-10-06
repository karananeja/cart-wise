# Project State Checkpoint

**Last updated:** 2026-10-06

## Current phase

Phase 1 MVP delivered — F-001 to F-011 all accepted (Gates 1 and 2, 2026-10-06). MVP wrap-up in progress.

## Current feature

None. MVP wrap-up (user choice, 2026-10-06): requirements audit, fixes, backlog triage, then Phase 2 sequencing.

## Completed

- Phase 0 discovery and documentation.
- F-001 catalog browsing · F-002 search + history · F-003 product details, sizes, reviews, recently viewed · F-004 guest cart · F-005 wishlist · F-006 authentication + guest merge · F-007 addresses (OpenStreetMap) · F-008 checkout with stock holds · F-009 simulated payment (card, UPI, bank offers) · F-010 orders, cancel/return/refund, delivery OTP, order simulation · F-011 inventory simulation.
- Core user decisions: Q1 React + Tailwind + shadcn/ui with an Express API and pnpm workspace; Q2 INR pricing at ₹96 = $1 (corrected from 1:1 on 2026-10-06); Q3 all 24 categories. Feature-level decisions are in each feature's `conversation-log.md` and in `requirements/open-questions.md`.
- MVP wrap-up so far: route-level code-splitting (main bundle 829 → 407 kB); signed-in history removal now reaches the account; error/offline states on account, order, payment and console pages; `orderId` on server payment/order events; stale docs corrected.

## In progress

MVP wrap-up: present audit findings and the product decisions it raised.

## Remaining

Phase 2 (brief §24) and optional AI (Phase 3), sequencing to be chosen by the user.

## Approved requirements / intents

All F-001–F-011 specifications and intents approved at Gate 1 and accepted at Gate 2 on 2026-10-06 (see each `docs/features/*/acceptance.md`).

## Architecture decisions

ADR-001 (architecture, accepted), ADR-002 (catalog snapshot + application inventory, accepted), ADR-003 (sessions, scrypt, simulated OTP, JSON-only POST guard, accepted), ADR-004 (Leaflet + OSM tiles + Nominatim via API proxy, accepted). F-003: inventory is per sellable unit (size or product); schema version 2 with automatic rebuild of seeded tables.

## Relevant files

- `apps/api/src/catalog/query.ts` — listing query (filters, disjunctive facets, sort, pagination, relaxations)
- `apps/api/src/inventory/inventory.ts` — seeded stock and availability rules (low stock ≤ 5)
- `apps/api/src/catalog/config.ts` — USD→INR rate (96)
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
- `packages/shared/src/orders.ts` (lifecycle, reasons, `allocatePaise`), `apps/api/src/orders/lifecycle.ts` (list, cancel, returns, operator steps), `apps/api/src/sim/` (operator password session, routes), `apps/web/src/features/orders/`, `apps/web/src/features/sim/`
- `packages/shared/src/simulation.ts`, `apps/api/src/sim/inventory.ts` (list, manual stock, ticks, settings), `apps/api/src/sim/scheduler.ts`, `apps/web/src/features/sim/SimConsole.tsx` + `SimInventoryPage.tsx`; `playwright.config.ts` runs `e2e/simulation.spec.ts` as a separate project after the others
- `apps/web/src/features/search/SearchBox.tsx` — header combobox; `apps/web/src/lib/recentSearches.ts` — history store

## Tests

- `pnpm test`: 401 passing (shared 38, api 215, web 148). `pnpm e2e`: 46 passing (11 consecutive full runs; one earlier unreproduced failure of an F-009 payment test noted in F-011 acceptance §3). Typecheck clean. Build succeeds.
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
- Gate 1 F-010: 2026-10-06 (order simulation in F-010; demo operator password; delivery charge not refunded on returns); Gate 2 F-010: 2026-10-06 (after return-dialog width fix).
- Gate 1 F-011: 2026-10-06; Gate 2 F-011: 2026-10-06.

## Exact next action

Draft F-012 Product discovery (Phase 2, user choice 2026-10-06): related products, frequently bought together, continue shopping, `recommendation_clicked`, deterministic rules (brief §17). Gather any product decisions, then present spec + intent for Gate 1.
