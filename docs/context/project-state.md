# Project State Checkpoint

**Last updated:** 2026-10-06

## Current phase

Phase 1 — MVP.

## Current feature

**F-003 Product details, sizes and recently viewed — specification and intent drafted, awaiting Gate 1.** F-001 and F-002 complete (accepted 2026-10-06).

## Completed

- Phase 0 discovery and documentation.
- User decisions (2026-10-06): Q1 React + Tailwind + shadcn/ui, Node.js Express API, pnpm workspace; Q2 ₹ at 1:1 with USD; Q3 all 24 categories. F-001 Gate 1 approved.
- ADR-001 and ADR-002 accepted.
- F-001 built: workspace, shared package, Express API (SQLite via better-sqlite3), committed DummyJSON snapshot + deterministic inventory seed, homepage, listing pages with filters/sort/pagination/URL state, product page stub, analytics pipeline (`filter_applied`), loading/empty/error/offline states.

- Gallery added to the product page stub after user feedback (2026-10-06).

## In progress

None. Waiting for Gate 1 approval of F-003.

## Remaining

F-002 → F-011 per `project-plan.md`, then Phase 2 and optional AI.

## Approved requirements / intents

- F-001 specification and intent (Gate 1, 2026-10-06); F-001 accepted (Gate 2, 2026-10-06).
- F-002 specification and intent (Gate 1, 2026-10-06).

## Architecture decisions

ADR-001 (architecture, accepted), ADR-002 (catalog snapshot + application inventory, accepted).

## Relevant files

- `apps/api/src/catalog/query.ts` — listing query (filters, disjunctive facets, sort, pagination, relaxations)
- `apps/api/src/inventory/inventory.ts` — seeded stock and availability rules (low stock ≤ 5)
- `apps/api/src/catalog/config.ts` — USD→INR rate (1)
- `packages/shared/src/listing-params.ts` — URL/API query contract
- `apps/web/src/features/catalog/` — pages, components, hooks
- `apps/web/src/lib/analytics.ts` — event client
- `apps/api/src/search/` — search index (MiniSearch + term processing, swapped-letter variants)
- `apps/web/src/features/search/SearchBox.tsx` — header combobox; `apps/web/src/lib/recentSearches.ts` — history store

## Tests

- `pnpm test`: 140 passing (shared 16, api 77, web 47). `pnpm e2e`: 12 passing (stable over 3 repeats). Typecheck clean. Build succeeds.
- No failing tests.

## Known bugs / limitations

See `features/F-001-catalog-browsing/acceptance.md` §3. No known bugs.

## Pending questions for the user

- Store name: "Cartwise" kept as placeholder (user did not address it).
- Q4 resolved (add sizes), Q5 resolved (no DummyJSON reviews). Q6–Q14 open for later features.
- F-003: confirm size sets (spec FR-6).

## Rejected approaches

- Fastify (user chose Express). Drizzle ORM and `node:sqlite` (plain SQL with better-sqlite3 instead; see ADR-001).
- Proxying DummyJSON live (ADR-002).

## User sign-offs

- Gate 1 F-001: 2026-10-06.
- Gate 2 F-001: 2026-10-06 ("proceed").
- Gate 1 F-002: 2026-10-06.
- Gate 2 F-002: 2026-10-06.

## Exact next action

Wait for Gate 1 approval of F-003 (`features/F-003-product-details/`). On approval: technical design (variants table, per-variant inventory, aggregate availability in the listing query, batch endpoint), test plan, implement, test, present for Gate 2.
