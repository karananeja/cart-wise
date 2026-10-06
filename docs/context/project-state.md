# Project State Checkpoint

**Last updated:** 2026-10-06

## Current phase

Phase 1 MVP delivered — F-001 to F-011 all accepted (Gates 1 and 2, 2026-10-06). MVP wrap-up in progress.

## Current feature

**F-014 EMI + Razorpay (test mode) — implemented and tested, awaiting Gate 2** (`docs/features/F-014-emi-and-razorpay/`, ADR-005 accepted). F-013 accepted 2026-10-06; previously (`docs/features/F-013-electronics-variants/`). F-012 accepted 2026-10-06.

## Completed

- Phase 0 discovery and documentation.
- F-001 catalog browsing · F-002 search + history · F-003 product details, sizes, reviews, recently viewed · F-004 guest cart · F-005 wishlist · F-006 authentication + guest merge · F-007 addresses (OpenStreetMap) · F-008 checkout with stock holds · F-009 simulated payment (card, UPI, bank offers) · F-010 orders, cancel/return/refund, delivery OTP, order simulation · F-011 inventory simulation.
- Core user decisions: Q1 React + Tailwind + shadcn/ui with an Express API and pnpm workspace; Q2 INR pricing at ₹96 = $1 (corrected from 1:1 on 2026-10-06); Q3 all 24 categories. Feature-level decisions are in each feature's `conversation-log.md` and in `requirements/open-questions.md`.
- MVP wrap-up so far: route-level code-splitting (main bundle 829 → 407 kB); signed-in history removal now reaches the account; error/offline states on account, order, payment and console pages; `orderId` on server payment/order events; stale docs corrected.

## In progress

F-014 Gate 2 (and the user's manual Razorpay test-mode check with their keys).

## Remaining

Phase 2 (brief §24) and optional AI (Phase 3), sequencing to be chosen by the user.

## Approved requirements / intents

All F-001–F-011 specifications and intents approved at Gate 1 and accepted at Gate 2 on 2026-10-06 (see each `docs/features/*/acceptance.md`).

## Architecture decisions

ADR-001 (architecture, accepted), ADR-002 (catalog snapshot + application inventory, accepted), ADR-003 (sessions, scrypt, simulated OTP, JSON-only POST guard, accepted), ADR-004 (Leaflet + OSM tiles + Nominatim via API proxy, accepted), ADR-005 (Razorpay test mode only, accepted). F-003: inventory is per sellable unit (size or product); schema version 2 with automatic rebuild of seeded tables.

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
- `packages/shared/src/recommendations.ts`, `apps/api/src/recommendations/` (rules, service, routes), `apps/web/src/features/discovery/`
- `apps/web/src/features/search/SearchBox.tsx` — header combobox; `apps/web/src/lib/recentSearches.ts` — history store
- F-014: `packages/shared/src/emi.ts`; `apps/api/src/payments/{razorpay,gatewayRefunds,fakeRazorpay}.ts`, payments service (EMI, Razorpay start/verify/finalize/reconcile/webhook); `apps/api/.env(.example)` loaded in `server.ts`; web `features/payment/{EmiBanner,EmiPlans,RazorpayPayment,razorpayCheckout,emiText,summary}`; tests `emi.test.ts`, `emi.api.test.ts`, `razorpay.api.test.ts`, `Emi.test.tsx`, `e2e/emi-razorpay.spec.ts`
- F-013: `apps/api/src/inventory/options.ts` (tiers, `tierPrices`), `apps/api/src/db/seed.ts` (`saveVariantLabels`, `remapUnits`), schema v3 (`product_variants.kind/price_paise/mrp_paise`, `order_lines.option_label`), `apps/web/src/features/catalog/selection.ts` (option/size hooks, `unitLabel`, `productLink`), `OptionSelector.tsx`; tests `options.test.ts`, `options.api.test.ts`, `ProductOptions.test.tsx`, `e2e/options.spec.ts`

## Tests

- `pnpm test`: 484 passing (shared 43, api 259, web 182). `pnpm e2e`: 56 passing (8 of 9 runs clean; one unexplained wishlist failure, in backlog). Typecheck clean. Build succeeds (main bundle 421 kB).
- E2E starts a fake Razorpay on port 3199 (`e2e/fake-razorpay-server.ts`); the API under E2E uses test keys pointed at it.

## Known bugs / limitations

See `features/F-001-catalog-browsing/acceptance.md` §3. No known bugs.

## Working rules

- The user runs `pnpm dev` (5173/3001, `store.db`) in their own terminal; the API reads `apps/api/.env` at start (restart needed after changes). Never stop it. Manual checks run on 5274/3201 with `preview.db`; E2E on 5174/3101 with `e2e.db`. Stop only those ports.

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
- Gate 1 F-012: 2026-10-06; Gate 2 F-012: 2026-10-06 (companion price cap not chosen; in backlog).
- Gate 1 F-013: 2026-10-06 (D1 tiers as proposed; D2 cheapest in-stock preselected; D3 "From ₹X"); Gate 2 F-013: 2026-10-06.
- Gate 1 F-014: 2026-10-06 (D1 EMI terms as proposed; D2 normal EMI + bank offer, no-cost excludes; D3 refunds via Razorpay). ADR-005 accepted.
- F-014 direction (2026-10-06): Razorpay test keys only; customer chooses Razorpay or demo payment; EMI simulated in demo mode, Razorpay EMI in Razorpay mode.

## Exact next action

Wait for Gate 2 on F-014 (`docs/features/F-014-emi-and-razorpay/acceptance.md`). The user may add Razorpay test keys to `apps/api/.env`, restart `pnpm dev` and try one payment + refund; record the result in acceptance §1. Then ask which item comes next.
