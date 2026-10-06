# ADR-002: Catalog Source and Inventory Ownership

**Status:** Accepted (2026-10-06; Q2 → ₹ at 1:1, Q3 → all categories)
**Date:** 2026-10-06

## Decision

Import DummyJSON products into the application's database as a catalog snapshot, keep inventory in a separate application-owned table, and never expose DummyJSON's shape or stock fields to the frontend.

## Context

- Brief §15 and §22: the external catalog is not the inventory authority; catalog and inventory must be logically separate.
- DummyJSON: 194 products, 24 categories, USD prices, `discountPercentage`, `rating`, 3 generic reviews each, images on `cdn.dummyjson.com`, its own `stock` / `availabilityStatus` / `minimumOrderQuantity` fields (verified 2026-10-06).

## Options Considered

1. **Proxy DummyJSON live through the API** — always fresh, but the app breaks when offline or when DummyJSON changes; filtering/sorting limited to what DummyJSON supports; extra latency.
2. **Import a snapshot into the app database** (chosen) — fast local queries, full control of filtering, sorting and search, works offline; snapshot can be re-imported.
3. **Hand-written local catalog** — full control, but large effort for no product value.

## Decision

- An import script fetches DummyJSON and saves the raw response as a committed snapshot file (`apps/api/data/catalog/dummyjson-products.json`). A seed step maps the snapshot to the app `Product` model (with `externalCatalogId`), converts prices at the configured rate (₹96 per $1 since 2026-10-06; changing it re-prices products in place on the next start) and loads all categories into the database. Because the snapshot is committed, a fresh clone runs without contacting DummyJSON and every seed is identical.
- A separate `inventory` table (`productId`, `onHand`, `reserved`) is seeded deterministically by the application. DummyJSON stock fields are discarded.
- Availability shown to users is derived from application inventory only: `available = onHand − reserved`; 0 → Out of stock; 1–5 → "Only N left"; otherwise In stock.

## Reason

Keeps the ownership boundary explicit, makes the frontend independent of the provider, and makes listing queries fast and fully controllable.

## Consequences

- Catalog changes upstream do not appear until re-import (acceptable).
- Prices, categories and brands are application data and can be adjusted without touching the provider.
- Images remain hotlinked to the DummyJSON CDN; the UI needs an image fallback.
