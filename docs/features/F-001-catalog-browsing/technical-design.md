# Technical Design — F-001 Catalog Browsing

**Status:** Implementation
**Inputs:** specification.md (approved), ADR-001, ADR-002

## 1. Workspace layout

```text
/
├── package.json            root scripts: dev, test, typecheck, e2e, db:seed, catalog:import
├── pnpm-workspace.yaml
├── packages/shared/        @store/shared — Zod schemas, API types, query-param parsing, money formatting
├── apps/api/               @store/api — Express 5, better-sqlite3, tsx
│   ├── data/catalog/dummyjson-products.json   committed snapshot
│   └── src/
│       ├── app.ts          createApp(db) — testable without listening
│       ├── server.ts       listens on :3001, seeds DB if empty
│       ├── db/             connection, schema SQL, seed
│       ├── catalog/        DummyJSON mapping, import script, listing query
│       ├── inventory/      deterministic seed, availability derivation
│       ├── analytics/      events route
│       └── http/           error handling
└── apps/web/               @store/web — Vite, React, Tailwind, shadcn/ui
    └── src/
        ├── app/            router, providers, layout (header, footer)
        ├── components/ui/  shadcn components
        ├── features/catalog/  pages, components, hooks, api
        ├── lib/            api client, analytics, formatting, online status
        └── test/           MSW handlers, fixtures, setup
```

The shared package is consumed as TypeScript source (no build step): Vite and tsx both compile it.

## 2. Data

SQLite file `apps/api/data/store.db` (git-ignored). Created from the committed snapshot on first start or with `pnpm db:seed`.

```sql
categories(slug PK, name, image_url, sort_order)
products(id PK, slug UNIQUE, external_catalog_id, title, description, brand, brand_slug,
         category_slug FK, mrp_paise, price_paise, discount_percent, rating,
         thumbnail_url, image_urls JSON, specifications JSON, tags JSON, catalog_order)
inventory(product_id PK FK, on_hand, reserved, updated_at)
analytics_events(id PK, name, properties JSON, visitor_id, occurred_at, received_at)
```

- Prices: `mrp_paise = round(usd × 100 × USD_TO_INR_RATE)` with the rate a single constant (currently `1`). `price_paise = round(mrp_paise × (1 − discount/100))`. `discount_percent` stored rounded to an integer; discounts below 1% are treated as no discount.
- Slugs: slugified title; on collision the external id is appended.
- Category names: `mens-shirts` → "Men's Shirts", hyphens to Title Case, with a small override map.
- Category image: thumbnail of the first product in the category (catalog order).
- Inventory seed: a seeded PRNG keyed by product id (mulberry32). About 6% of products get 0, about 10% get 1–5, the rest 8–60. Pure function, so re-seeding gives identical stock.

## 3. Listing query

The catalog is about 200 rows. The API loads the category scope (products joined to inventory) with one SQL query per request, then filters, facets, sorts and paginates in a pure TypeScript function, `queryCatalog(rows, query)`. This keeps the faceting logic (counts that exclude their own filter) simple and fully unit-testable. If the catalog grows by orders of magnitude, push filtering into SQL; the function signature stays the same.

- Facets follow disjunctive faceting: each facet's counts apply every *other* active filter.
- `relaxations`: when `total = 0`, for each active filter group (category, brand, price, rating, inStock) the count obtained by removing only that group.
- Sort: available items before out-of-stock items, then the chosen key, then catalog order as a tiebreaker.
- Page is clamped to `[1, lastPage]`.

## 4. Shared query contract

`parseListingParams(URLSearchParams)` is lenient: invalid values are dropped, never thrown. `serializeListingParams` produces a canonical query string (sorted brand list, defaults omitted). The web app uses both for URL ↔ state; the API uses the parser for requests. Because the API and the web URL share one format, there is no mapping layer.

## 5. API

Express 5 (async errors are forwarded automatically). JSON error envelope `{ error: { code, message } }`. Unknown routes return 404. The error handler logs the error server-side and returns a generic 500 message.

## 6. Web

- Router: `/`, `/products`, `/c/:categorySlug`, `/p/:productSlug`, `*` → Not found.
- Server state: TanStack Query; listing uses `placeholderData: keepPreviousData`; `networkMode: 'online'` pauses queries offline, and they resume on reconnect.
- URL is the state: a `useListingParams()` hook reads, writes and normalises the query string (invalid params are replaced with `replace: true`).
- Mobile filter sheet holds a draft; its "Show N results" count comes from a query with the draft params.
- `filter_applied`: the change handler records `{filter, value}`; when the query for those params resolves, the event fires with `resultCount`.
- Analytics client: queue in memory, flush every 2 s and on `pagehide` via `navigator.sendBeacon`. Visitor id in `localStorage` (try/catch, falls back to an in-memory id).
- Dev proxy: Vite proxies `/api` to `http://localhost:3001`.

## 7. Testing tools

Vitest in each package; Supertest against `createApp(inMemoryDb)` for the API; Testing Library + MSW + jsdom for the web; Playwright (Chromium) for E2E against the real dev servers.
