# Technical Design — F-004 Guest cart

**Status:** Implementation
**Inputs:** specification.md (approved), ADR-001/002, F-003 design (sellable units)

## 1. Data

```sql
carts(id TEXT PK, created_at, updated_at)
cart_lines(id INTEGER PK, cart_id FK → carts ON DELETE CASCADE,
           product_id FK → products ON DELETE CASCADE, variant_id FK → product_variants ON DELETE CASCADE NULL,
           quantity CHECK 1..10, added_at)
UNIQUE INDEX cart_lines_unit ON cart_lines(cart_id, product_id, IFNULL(variant_id, 0))
```

- **Uniqueness:** SQLite treats NULLs as distinct in a plain `UNIQUE`, so uniqueness of a line uses an expression index (`IFNULL(variant_id, 0)`).
- **New tables only:** no schema-version bump is needed (`CREATE … IF NOT EXISTS`).
- **Re-seeding:** re-seeding the catalog deletes products and variants, and the cascades empty carts. That is correct, because variant ids change on re-seed. `pnpm db:seed` is a reset tool.
- **Expiry:** carts with `updated_at` older than 30 days are deleted at API start and hourly (an unref'd timer). An expired cart id in a cookie behaves like no cart.

## 2. Cart identity

- **Cookie:** `cart_id` — 16 random bytes, base64url. Set as HTTP-only, `SameSite=Lax`, `Path=/`, `Max-Age` 30 days, and refreshed on every write.
- **Parsing:** a tiny parser on `req.headers.cookie`; no dependency needed.
- **Creation:** `GET` never creates a cart; the first `POST /lines` does.

## 3. Rules (`cart/rules.ts`, pure)

- `MAX_PER_LINE = 10`.
- **Available stock per line:** the inventory row for `(product, variant)` (variant `NULL` for unsized products), `max(0, on_hand − reserved)`.
- **`maxQuantity`** = `min(10, available)`.
- **`issue`:**
  - `out_of_stock` when available = 0;
  - `exceeds_stock` when quantity > available;
  - otherwise `none`.
- **Totals** cover lines with no issue only:
  - `itemCount` = Σ quantity;
  - `mrpPaise`, `subtotalPaise` = Σ unit price × quantity;
  - `discountPaise` = MRP − subtotal.
- **`totalQuantity`** (all lines) drives the header badge.
- **Line order:** lines with issues first, then newest added first.
- **Add:**
  - validate the product and size (`SIZE_REQUIRED`, `INVALID_SIZE`), then stock (`OUT_OF_STOCK`);
  - if the line exists, the new quantity is existing + requested;
  - anything above `maxQuantity` → `QUANTITY_LIMIT` with `max`.
- **Update:** quantity must be 1–10; an *increase* must stay ≤ available. A decrease is always allowed, so users can resolve `exceeds_stock` themselves.

## 4. API

`cart/routes.ts` handles `GET /api/cart`, `POST /api/cart/lines`, `PATCH /api/cart/lines/:id` and `DELETE /api/cart/lines/:id`. Bodies are validated with Zod. Every response is the full `CartView`. Errors use the shared envelope, plus `details.max` for `QUANTITY_LIMIT`.

## 5. Web

- **Data hooks:** `features/cart/api.ts` — `useCart` (key `['cart']`) and mutations add, update and remove.
  - All mutations share TanStack Query's `scope: { id: 'cart' }`, so they run one at a time and responses can't arrive out of order.
  - Each successful mutation writes the returned cart into the cache.
  - Update and remove are optimistic: quantity, or line removal, changes in the cache immediately and the snapshot is restored on error.
- **API client:** `lib/api.ts` gains `apiSend` (POST/PATCH/DELETE with a JSON body). `ApiError` carries `details`.
- **Components:**
  - `HeaderCartLink`;
  - `AddToCartButton` (in the purchase panel; focuses the size group when a size is missing);
  - `CartPage` with `CartLine`, `QuantityStepper`, `CartSummary`, `CartIssuesNotice`, `UndoToast` and `EmptyCart`.
- **Undo:** re-adds the removed product, size and quantity through the add endpoint.
- **Analytics:** fired after server success: added (`source`: `product_page` or `undo`) and removed.
