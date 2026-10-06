# Test Plan

**Feature:** F-013 — Electronics variants

## 1. Scope

**Tested:**
- tier sets and tier pricing;
- seeding;
- the product detail and listing contract;
- cart rules per option;
- checkout, payment and stock per option;
- sign-in merge;
- the schema v3 upgrade and the reseed remap;
- product page, cart, wishlist, pairing and console UI;
- the full purchase journey.

**Not tested:** visual polish. It was checked manually with screenshots at 1280 px and 360 px.

## 2. Risk areas

- **Wrong price charged:** the cart, quote, order snapshot or payment using the product price instead of the option price.
- **Wrong unit held or sold:** stock reserved or sold on another option or on a product-level unit.
- **Upgrade damage:** the reseed shifts variant ids, which could move cart lines or holds to the wrong size, lose holds, or drop existing cart lines.
- **Blind picks:** an option added without the shopper seeing which one. Bundle adds of companions with options.
- **Regressions:** existing tests that relied on phones and laptops having no options.

## 3. Tests

| Level | Area | Cases | File |
|---|---|---|---|
| Unit | Options | Tier sets per category; other categories have none; base tier unchanged to the paisa; steps rounded to the rupee; deterministic stock; every phone, tablet and laptop seeded with 3 rising tiers and no product-level unit; some tiers low or sold out | `apps/api/src/inventory/options.test.ts` |
| API | Catalog | Options with prices, discount and availability; sold-out tier; `optionName`; `hasOptions` on summaries; price filter on the starting price | `apps/api/src/catalog/options.api.test.ts` |
| API | Cart | `OPTION_REQUIRED`, `INVALID_OPTION`, size sent for an option product; two tiers → two lines at their own prices and totals; limits per tier | same |
| API | Checkout / payment | Order line snapshots the option and its price; total; hold and sale on that option only | same |
| API | Merge | Same tier combined (larger quantity), other tier kept separate | same |
| Integration | Upgrade | v2 database with shifted variant ids: sizes keep their label in carts and orders; option-less phone lines move to 128 GB; holds rebuilt; remap table dropped. A re-run seed keeps sized cart lines | `apps/api/src/db/database.test.ts` |
| API | Regressions | Generic unsized-product tests moved from the iPhone X to an accessory; recommendation tests add phones with their base option | existing API tests |
| Component | Product page | Cheapest in-stock option preselected; prices on options; sold-out option disabled; price, MRP and availability follow the option; URL keeps it; sold-out or unknown option in the URL ignored; add uses the option and its price (`cart_item_added`); another option → its own line | `apps/web/src/features/catalog/pages/ProductOptions.test.tsx` |
| Component | Lines and cards | Cart line shows the option, its price and a link with `?option=`; "From" on cards | same |
| Component | Pairing | Companion with options → "Choose option" with a "From" price; Add both adds this product in the chosen option at its price | `apps/web/src/features/discovery/Discovery.test.tsx` |
| Component | Wishlist | Move to cart asks "Choose storage", preselects the cheapest in stock, sold-out disabled | `apps/web/src/features/wishlist/Wishlist.test.tsx` |
| Component | Console | "Show options", "Option 256 GB", stepper per option | `apps/web/src/features/sim/SimInventory.test.tsx` |
| E2E | Journey | Phone → 256 GB → cart → checkout → card + bank OTP → confirmation and order show 256 GB at its price; only that option is held and then sold. Laptop configurations at 360 px without horizontal scroll | `e2e/options.spec.ts` |
| E2E | Regressions | Stock-drop test on a phone option; sorting by "From" prices; API orders with phones | `e2e/cart.spec.ts`, `e2e/browse.spec.ts`, `e2e/discovery.spec.ts` |

## 4. Manual verification

- **Screenshots** of the laptop page and the smartphone listing at 1280 px and 360 px, on the preview ports with `preview.db`:
  - the options wrap;
  - the selected and sold-out states read clearly;
  - "From" shows on cards.
- **Upgrades:**
  - `preview.db` and the developer's `store.db` upgraded to schema 3 on restart;
  - `store.db` kept its 5 cart lines, with no dangling variant ids.

## 5. Results

| Run date | Command | Result | Notes |
|---|---|---|---|
| 2026-10-06 | `pnpm test` | 453 passed (shared 38, api 241, web 174) | |
| 2026-10-06 | `pnpm e2e` ×3 | 53 passed each run | Includes 2 new option tests |
| 2026-10-06 | `pnpm typecheck`, `pnpm build` | Clean | Main bundle 416 kB |
