# Feature Specification

## Feature

**ID:** F-001
**Name:** Catalog Browsing — foundation, home, categories, product listing, filters, sorting
**Status:** Complete (Gate 1 and Gate 2 approved 2026-10-06)
**Requirements:** DISC-1..5, INV-1, INV-3, STATE-1, ANL-1 (`filter_applied`), NFR-1..4, NFR-6..8

---

## 1. Objective

Let any visitor, with no account, open the store and find products by browsing categories and narrowing a product list with filters and sorting. Lay the foundation every later feature builds on: the workspace, the application API, the imported catalog, application-owned inventory, the app shell, and the analytics pipeline.

## 2. User Problem

A shopper who does not yet know exactly what they want needs to explore the range, narrow it to what fits their budget and expectations, and compare candidates at a glance, without signing up and without wading through irrelevant items.

## 3. User Intent

"Show me what you have in this kind of thing, and help me narrow it to the few that are worth looking at."

## 4. User Stories

- As a guest, I want to see the store's categories on the homepage so I can start browsing immediately.
- As a guest, I want to open a category and see its products with price, discount, rating and availability so I can compare at a glance.
- As a guest, I want to filter by price, brand, rating and availability so I see only relevant products.
- As a guest, I want to sort by price, rating or discount so the best candidates are at the top.
- As a guest, I want to share or bookmark a filtered list, and use the browser Back button, without losing my filters.
- As a guest, I want to clearly see when something is out of stock or nearly gone, and trust that this is real.

## 5. Functional Requirements

### 5.1 Foundation

- FR-1 Workspace per ADR-001: `apps/web`, `apps/api`, `packages/shared`; `pnpm install` + `pnpm dev` runs the app locally.
- FR-2 Catalog import script per ADR-002: imports DummyJSON into the local database, importing all categories (Q3), converting prices at the configured rate (Q2: currently 1 USD = ₹1). Idempotent (re-running replaces the snapshot without duplicating).
- FR-3 Inventory seeding: each imported product gets an application inventory record with a deterministic seeded `onHand` (same result every run). The seed includes a small number of out-of-stock and low-stock products so those states are demonstrable. DummyJSON stock fields are discarded.
- FR-4 App shell: header with store name/logo and category navigation; footer with a persistent "Demo store — products, reviews and payments are simulated" notice (NFR-8). Header elements for search, cart, wishlist and account are added by their own features, not shown as non-working placeholders.

### 5.2 Homepage (`/`)

- FR-5 Category grid: every imported category with a representative image and display name.
- FR-6 Two factual discovery rails, each linking to the full sorted listing:
  - "Top rated" — highest catalog rating, in-stock only.
  - "Biggest discounts" — highest discount percentage, in-stock only.
  No "Trending" or popularity rail: there is no real behavioural data yet, and the brief forbids fabricated social proof. The richer discovery homepage is a Phase 2 feature.

### 5.3 Product listing (`/products` and `/c/:categorySlug`)

- FR-7 `/products` lists all products; `/c/:categorySlug` lists one category with a heading and breadcrumb (Home › Category).
- FR-8 Product card shows: image, title, brand, selling price, original price struck through and discount % (only when discount ≥ 1%), rating (stars + numeric), and an availability badge only when relevant ("Only N left" when 1–5 available, "Out of stock" when 0). The whole card links to the product page.
- FR-9 Filters:
  | Filter | Control | Values |
  |---|---|---|
  | Category | single select | Only on `/products` (category pages already scope this) |
  | Price | min / max inputs with preset ranges derived from the result set | ₹ |
  | Brand | multi-select checkbox list, with counts; collapsed to top 8 with "Show all" | from facets |
  | Rating | single select | 4★ & up, 3★ & up |
  | Availability | toggle | "In stock only" (off by default) |
- FR-10 Facet counts reflect the current result set (brand counts update as other filters change). Options that would yield zero results are shown disabled, not hidden, so the user understands why.
- FR-11 Active filters appear as removable chips above the results, plus "Clear all".
- FR-12 Sort options: Featured (default — catalog order with out-of-stock items last), Price: low to high, Price: high to low, Customer rating, Biggest discount. Out-of-stock items sort after available items in every sort order.
- FR-13 Result count shown ("124 products") and announced to screen readers when it changes.
- FR-14 Pagination: 24 products per page, numbered pages with Previous/Next. Changing a filter or sort resets to page 1. Scroll returns to the top of results on page change.
- FR-15 URL is the source of truth for filters, sort and page (e.g. `/c/laptops?brand=apple,asus&price=50000-150000&rating=4&inStock=1&sort=price_asc&page=2`). Back/forward, reload and shared links reproduce the same view. Invalid parameters are ignored, not errors.

### 5.4 Product page stub (`/p/:productSlug`)

- FR-16 Listing cards must lead somewhere real. Until F-003, `/p/:productSlug` shows a minimal product view (image gallery with thumbnails when a product has several images, title, brand, price, availability, description) with a link back. The gallery was added at the user's request on 2026-10-06. F-003 replaces it with the full product page. No cart/wishlist buttons in the stub.

### 5.5 Analytics

- FR-17 Shared client `track(event, properties)` with batching; events POSTed to `POST /api/events` and stored with timestamp and an anonymous visitor id (random id in local storage, no personal data).
- FR-18 `filter_applied` fired when a filter is added or changed: `{ filter, value, resultCount, categorySlug }`. Sort changes are not tracked as `filter_applied` (not in the brief's event set).

## 6. Non-Functional Requirements

- Performance: listing API responds < 150 ms locally for any filter combination; images lazy-loaded below the fold with reserved aspect ratio (no layout shift); previous results stay visible (dimmed) while the next filter result loads rather than flashing skeletons.
- Accessibility: all filters keyboard operable and labelled; filter panel on mobile is a focus-trapped dialog; result count in an `aria-live` region; card images have alt text; colour contrast AA; visible focus rings.
- Responsiveness: grid of 2 columns (< 640 px), 3 (≥ 640 px), 4 (≥ 1024 px); filters in a left sidebar ≥ 1024 px, in a bottom sheet below that.
- Reliability: app works after import without DummyJSON reachable, except product images (which fall back to a placeholder).
- Security: API validates and bounds all query parameters (Zod); no user data collected in this feature beyond the anonymous visitor id.
- Maintainability: frontend consumes only `packages/shared` types and application endpoints, never DummyJSON shapes.

## 7. UX Requirements

- Primary action on listing: open a product. Filters are secondary and progressively disclosed (brand list collapsed, mobile filters behind one "Filters" button showing active count).
- Mobile filter sheet applies changes live to the count ("Show 37 results") and applies on confirm, avoiding a reload per tap.
- No authentication anywhere in this feature.
- Feedback: filter changes reflect within one interaction; chips confirm what is active.
- Prices formatted with en-IN grouping (`₹1,29,999`). Because Q2 sets a 1:1 rate, many prices have paise; whole-rupee amounts show no decimals, others show two (`₹9.99`).
- No fake urgency: "Only N left" appears only from real inventory ≤ 5.

## 8. UI Requirements

Screens: Homepage, All products listing, Category listing, Product page stub, Not found (unknown category or product).

Components: AppShell (Header, CategoryNav, Footer with demo notice), CategoryGrid, ProductRail, ProductCard, ProductGrid, FilterPanel (desktop) / FilterSheet (mobile), PriceRangeFilter, BrandFilter, RatingFilter, AvailabilityToggle, ActiveFilterChips, SortSelect, Pagination, ResultCount, Breadcrumb, Skeletons, EmptyState, ErrorState, OfflineBanner, ImageWithFallback.

States per screen: loading, success, empty, error, offline (see §12–14).

## 9. Data Requirements

| Entity | Fields | Owner | Notes |
|---|---|---|---|
| Category | slug, name, imageUrl, productCount | Application (derived from import) | Display names prettified ("mens-shirts" → "Men's Shirts") |
| Product | id, slug, externalCatalogId, title, description, brand, brandSlug, categorySlug, mrpPaise, pricePaise, discountPercent, rating, imageUrls, thumbnailUrl, specifications (warranty, shipping info), tags | Application (catalog snapshot) | Prices integer paise. `pricePaise = round(mrp × (1 − discount/100))` |
| Inventory | productId, onHand, reserved, updatedAt | Application | Separate table; `reserved` is 0 until F-008 |
| AnalyticsEvent | id, name, properties (JSON), visitorId, occurredAt | Application | |

Persistence: SQLite file in `apps/api` data directory (git-ignored); created by migrations + import script.

## 10. API Requirements

All under `/api`, JSON, no authentication.

| Endpoint | Purpose | Response |
|---|---|---|
| `GET /api/categories` | Category list | `{ categories: Category[] }` |
| `GET /api/products` | Listing. Same query parameters as the web URL: `category`, `brand` (comma list of brand slugs), `price` (`min-max` in rupees, either side optional), `rating` (3/4), `inStock` (1), `sort` (`featured`, `price_asc`, `price_desc`, `rating`, `discount`), `page`, `pageSize` (max 48) | `{ items: ProductSummary[], page, pageSize, total, facets: { brands, categories, ratings, inStock, price }, relaxations }` — `relaxations` lists, when there are no results, how many results removing each active filter would give (drives the empty-state suggestion) |
| `GET /api/products/:slug` | Product stub data | `{ product: ProductDetail }` or 404 |
| `POST /api/events` | Analytics batch | `202 Accepted` |

`ProductSummary` includes `availability: { status: 'in_stock' | 'low_stock' | 'out_of_stock', available?: number }` — `available` only present when `low_stock`. Raw `onHand`/`reserved` are not exposed.

Errors: `400` with `{ error: { code, message } }` for invalid params that cannot be ignored; `404` for unknown category/product; `500` generic message. Frontend maps these to user-facing states and never shows the raw message.

## 11. State Management

- Server state: TanStack Query, keyed by normalised URL params; previous page data kept while fetching; categories cached for the session.
- URL state: filters/sort/page parsed from and written to the query string (single source of truth).
- Local UI state: mobile filter sheet draft selections until "Show results".
- Persistence: anonymous visitor id in local storage. Nothing else persisted in this feature.

## 12. Loading States

- First load of homepage/listing: skeleton cards matching final layout (no spinners on blank pages).
- Filter/sort/page change: keep current results visible with reduced opacity and a slim progress indicator; result count updates when data arrives.
- Images: neutral placeholder block with reserved aspect ratio until loaded.

## 13. Empty States

- No products match filters: "No products match these filters", list the active filters with one-tap removal, suggest the single filter whose removal yields the most results ("Remove 'Brand: Asus' to see 18 products"), plus "Clear all filters".
- Category with zero in-stock products when "In stock only" is on: same pattern, suggesting turning the toggle off.

## 14. Error States

- API failure: "We couldn't load products right now" with Retry; if previous data exists, keep it visible with an inline notice instead of replacing the page.
- Unknown category or product slug: Not found page with links to Home and All products.
- Offline: banner "You're offline — showing what we last loaded" when cached data exists; otherwise offline empty state with Retry when connection returns (auto-retry on reconnect).
- Image load failure: placeholder graphic, card still usable.
- Invalid URL params: ignored silently, normalised URL replaces the bad one.

## 15. Security Considerations

- Query parameters validated and bounded server-side (page size cap, numeric ranges, enum sort values) to prevent expensive queries.
- `POST /api/events` validates event names against the allowed set, caps batch size and property size.
- No personal data collected; visitor id is random and not linked to any identity in this feature.

## 16. Analytics

`filter_applied` (FR-18). `product_viewed` belongs to F-003; `search_*` to F-002.

## 17. Acceptance Criteria

1. Given a fresh clone, when I run the documented install, import and dev commands, then the store opens locally and shows the homepage with all imported categories.
2. All 24 DummyJSON categories, including `vehicle` and `motorcycle`, are browsable (Q3).
3. All prices display in ₹ at the configured 1:1 rate with Indian digit grouping; discounted products show original price struck through and the discount %.
4. Given a category page, when I select brand "X" and "4★ & up", then only products of brand X with rating ≥ 4 are shown, the count matches, and the chips show both filters.
5. Given filters applied, when I copy the URL into a new tab, then the same products, filters, sort and page are shown.
6. Given I apply filters and go to page 2, when I press Back, then I return to page 1 with the same filters.
7. Each sort option orders results correctly, and out-of-stock products always appear after available products.
8. A product with 0 available inventory shows "Out of stock"; one with 1–5 shows "Only N left"; others show no badge. These values come from the application inventory table, not DummyJSON.
9. Re-running the import and seed produces identical catalog and inventory (deterministic).
10. When filters yield no results, the empty state names the filters and offers a removal suggestion that, when used, returns results.
11. When the API is stopped, the listing shows a friendly error with Retry and no raw error text; when restarted, Retry recovers.
12. Below 1024 px, filters open in a bottom sheet; the grid is 2/3/4 columns at the specified breakpoints; no horizontal scroll at 360 px.
13. All filter, sort and pagination controls are operable by keyboard alone, and the result count change is announced to screen readers.
14. Applying a filter records a `filter_applied` event in the database with the specified properties.
15. Clicking a product card opens `/p/:slug` showing the stub product view; an unknown slug shows Not found.
16. The footer demo notice is visible on every page.

## 18. Testing Strategy

- Unit (shared/api): price conversion and rounding, discount calculation, availability derivation, slug and display-name generation, query-param parsing/normalisation, inventory seed determinism.
- API (Fastify inject against a seeded test DB): `/api/products` for each filter, combination, each sort, pagination bounds, facet counts, invalid params, 404s; `/api/events` validation.
- Component (Testing Library + MSW): ProductCard variants (discount/no discount, low/out of stock, image failure), FilterPanel interactions and chips, EmptyState suggestion, ErrorState retry, URL ↔ state sync.
- E2E (Playwright, one or two flows): homepage → category → filter + sort → page 2 → Back; mobile viewport filter sheet.
- Not tested: visual polish (manual review), DummyJSON availability (import is a one-time script; it has a mapping unit test against a fixture).

## 19. Dependencies

- Decisions Q1 (ADR-001), Q2 (currency), Q3 (categories) — resolved.
- Network access to DummyJSON for the one-time import; image CDN for images.
- Node ≥ 22, pnpm 10 (available: Node 24.14, pnpm 10.33).

## 20. Out of Scope

Search and search history (F-002); full product page, variants, reviews, recently viewed (F-003); cart (F-004); wishlist (F-005); accounts (F-006); recommendations and "Trending" (Phase 2); price-drop/back-in-stock; any AI; analytics dashboards; inventory changes after seeding (F-011).

## 21. Assumptions

- Q1–Q3 resolved 2026-10-06 (see §22).
- DummyJSON `price` is treated as the original (MRP) price and `discountPercentage` is applied to derive the selling price.
- DummyJSON catalog ratings are shown as catalog data; their demo nature is covered by the site-wide notice (reviews labelling handled in F-003).
- "Featured" order is the catalog's import order, not a popularity signal.
- Low-stock threshold is 5.

## 22. Decisions Required From User

None outstanding. Resolved 2026-10-06:

1. Q1 — React + Tailwind CSS + shadcn/ui; Node.js Express API; pnpm workspace.
2. Q2 — ₹ at 1:1 with USD for now.
3. Q3 — All 24 categories.
