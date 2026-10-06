# Project State Checkpoint

**Last updated:** 2026-10-06

## Current phase

Phase 1 — MVP.

## Current feature

**F-004 Guest cart — specification and intent drafted, awaiting Gate 1.** F-001, F-002 and F-003 complete (accepted 2026-10-06).

## Completed

- Phase 0 discovery and documentation.
- User decisions (2026-10-06): Q1 React + Tailwind + shadcn/ui, Node.js Express API, pnpm workspace; Q2 ₹ at 1:1 with USD; Q3 all 24 categories. F-001 Gate 1 approved.
- ADR-001 and ADR-002 accepted.
- F-001 built: workspace, shared package, Express API (SQLite via better-sqlite3), committed DummyJSON snapshot + deterministic inventory seed, homepage, listing pages with filters/sort/pagination/URL state, product page stub, analytics pipeline (`filter_applied`), loading/empty/error/offline states.

- Gallery added to the product page stub after user feedback (2026-10-06).

## In progress

None. Waiting for Gate 1 approval of F-004.

## Remaining

F-002 → F-011 per `project-plan.md`, then Phase 2 and optional AI.

## Approved requirements / intents

- F-001 specification and intent (Gate 1, 2026-10-06); F-001 accepted (Gate 2, 2026-10-06).
- F-002 specification and intent (Gate 1, 2026-10-06); F-002 accepted (Gate 2, 2026-10-06).
- F-003 specification and intent (Gate 1, 2026-10-06), size sets as proposed; F-003 accepted (Gate 2, 2026-10-06).

## Architecture decisions

ADR-001 (architecture, accepted), ADR-002 (catalog snapshot + application inventory, accepted). F-003: inventory is per sellable unit (size or product); schema version 2 with automatic rebuild of seeded tables.

## Relevant files

- `apps/api/src/catalog/query.ts` — listing query (filters, disjunctive facets, sort, pagination, relaxations)
- `apps/api/src/inventory/inventory.ts` — seeded stock and availability rules (low stock ≤ 5)
- `apps/api/src/catalog/config.ts` — USD→INR rate (1)
- `packages/shared/src/listing-params.ts` — URL/API query contract
- `apps/web/src/features/catalog/` — pages, components, hooks
- `apps/web/src/lib/analytics.ts` — event client
- `apps/api/src/search/` — search index (MiniSearch + term processing, swapped-letter variants)
- `apps/api/src/inventory/sizes.ts` — size sets; `apps/web/src/lib/localList.ts` — bounded local lists (recent searches, recently viewed)
- `apps/web/src/features/search/SearchBox.tsx` — header combobox; `apps/web/src/lib/recentSearches.ts` — history store

## Tests

- `pnpm test`: 162 passing (shared 16, api 89, web 57). `pnpm e2e`: 17 passing (stable over 3 repeats). Typecheck clean. Build succeeds.
- No failing tests.

## Known bugs / limitations

See `features/F-001-catalog-browsing/acceptance.md` §3. No known bugs.

## Pending questions for the user

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

## Exact next action

Wait for Gate 1 approval of F-004 (`features/F-004-guest-cart/`), including confirmation of the 10-per-line limit, 30-day guest cart lifetime and "Go to cart" behaviour. On approval: technical design (carts and cart_lines tables, anonymous cookie, cart view builder, optimistic mutations), test plan, implement, test, present for Gate 2.
