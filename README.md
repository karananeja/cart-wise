# Cartwise — demo e-commerce store

A locally runnable demo store showing a modern shopping journey. Products come from a committed
[DummyJSON](https://dummyjson.com) snapshot; inventory, users, carts and orders are owned by the
application. Payments are simulated and no real money moves.

Product and planning documentation lives in [`docs/`](docs/) — start with
[`docs/context/project-state.md`](docs/context/project-state.md).

## Requirements

- Node.js 22 or newer (developed on 24)
- pnpm 10 (`corepack enable` provides it)

## Getting started

```bash
pnpm install
pnpm dev            # API on http://localhost:3001, web app on http://localhost:5173
```

On first start the API creates `apps/api/data/store.db` and seeds it from the committed catalog
snapshot, so no network access is needed apart from product images.

| Command | What it does |
|---|---|
| `pnpm dev` | Runs the API and web app with reload |
| `pnpm db:seed` | Resets catalog and inventory from the snapshot (keeps analytics events) |
| `pnpm catalog:import` | Re-downloads the DummyJSON snapshot (network); follow with `pnpm db:seed` |
| `pnpm test` | Unit, API and component tests (Vitest) |
| `pnpm typecheck` | TypeScript checks for every package |
| `pnpm e2e` | Playwright end-to-end tests (first time: `pnpm exec playwright install chromium`) |
| `pnpm build` | Production build of the web app |

## Layout

```text
apps/api         Express API, SQLite (better-sqlite3), catalog import and inventory
apps/web         React + Vite + Tailwind CSS + shadcn/ui
packages/shared  Types, query-string contract and formatting shared by both
e2e              Playwright tests
docs             Brief, PRD, plan, decisions and per-feature specs
```

## Notes

- Prices are converted from USD at a configurable rate (`apps/api/src/catalog/config.ts`, currently 1:1).
- Stock levels come from the application's own inventory table, seeded deterministically — not from DummyJSON.
