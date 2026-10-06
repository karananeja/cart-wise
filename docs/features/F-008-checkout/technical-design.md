# Technical Design — F-008 Checkout

**Status:** Implementation
**Inputs:** specification.md (approved), F-004 cart, F-007 addresses, ADR-002 (inventory)

## 1. Shared

`checkout.ts` holds:
- the delivery rules (₹999 threshold, ₹49 Standard, ₹149 Express, 3–5 and 1–2 day estimates);
- `deliveryOptions(subtotalPaise, now)`;
- the `CheckoutQuote`, `Order` and `OrderStatus` types.

The API is the authority. The test mock reuses these rules so the numbers match.

## 2. Data

```sql
orders(id TEXT PK 'ORD-XXXXXXXX', user_id FK, status, address JSON, delivery_option, delivery_estimate JSON,
       item_count, mrp_paise, discount_paise, delivery_paise, total_paise,
       created_at, hold_expires_at, hold_released_at NULL, updated_at)
order_lines(id PK, order_id FK CASCADE, product_id, variant_id NULL, title, size NULL, thumbnail_url,
            quantity, unit_price_paise, unit_mrp_paise)
```

## 3. Reservation (atomic)

`createOrder` runs in one SQLite transaction:
1. cancel and release the user's previous pending order;
2. load the account cart (raw lines with `variant_id`) and refuse if it is empty or has issues;
3. check the address is the user's own;
4. for each line, run `UPDATE inventory SET reserved = reserved + q WHERE … AND on_hand - reserved >= q`. Zero changed rows aborts the whole transaction (`CART_CHANGED`);
5. insert the order and its lines.

`release(order)` is guarded by `hold_released_at IS NULL` and decrements `reserved` (never below 0), so it runs at most once per order.

**Expiry:** `sweepExpired()` runs at API start, every 30 seconds, and before any read or cancel of a pending order.

**Own hold in the cart:** while a customer has a pending order, their *own* cart adds back their held quantities when computing availability, so their held items don't show as sold out to them. Other shoppers see the reduced stock.

## 4. API

| Endpoint | Behaviour |
|---|---|
| `GET /api/checkout` | Quote from the account cart, the chosen or default address and the delivery option |
| `POST /api/orders` | `createOrder` |
| `GET /api/orders/:id` | Owner only; sweeps first |
| `POST /api/orders/:id/cancel` | Pending only; releases |

The order service takes an injectable clock for expiry tests.

## 5. Web (`features/checkout/`)

- **CheckoutPage:**
  - signed-in gate (`returnTo=/checkout` plus the current query);
  - `addressId` and `delivery` kept in the URL;
  - three sections plus the summary, with a sticky bar on mobile;
  - `checkout_started` once per mount.
- **PaymentPage** (`/checkout/pay/:orderId`): `HoldCountdown` (announces at 5 minutes, 1 minute and expiry, and refetches the order at zero), and Cancel.
- **Cart:** the summary and the mobile bar gain Proceed to checkout.
- **Address editor:** returning to `/checkout` after adding appends `addressId` for the new address.
