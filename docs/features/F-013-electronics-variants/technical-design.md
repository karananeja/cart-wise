# Technical Design — F-013 Electronics variants

**Status:** Implemented
**Inputs:** specification.md (approved 2026-10-06), ADR-002 (application-owned catalog extensions and inventory), F-003 sizes and units

## 1. Data (schema version 3)

- **`product_variants`:**
  - gains `kind TEXT NOT NULL DEFAULT 'size'` (`size` | `option`) and nullable `price_paise` / `mrp_paise`;
  - sizes leave the prices null and use the product price.
- **`products.price_paise` / `mrp_paise`:** for products with options, these stay the base (lowest) tier. Everything that reads the summary therefore keeps working: the listing filter and sort, the facet range, recommendations, typeahead and wishlist. They now mean "from".
- **`order_lines`:** gains `option_label TEXT` (via `ensureColumn`), and `size` stays for sizes. A separate column keeps past orders unambiguous without joining a mutable variants table.
- **`inventory`:** unchanged; one row per tier.

## 2. Option rules (`apps/api/src/inventory/options.ts`)

- **`OPTION_SETS`:** per category, a list of `{ label, stepPercent }`, following spec FR-1.
- **`optionPrices(mrpPaise, discountPercent, stepPercent)`:** the tier MRP is `round(mrp × (1 + step/100))`. The tier price applies the same discount and is rounded to the rupee (100 paise).
  - The base tier (step 0) returns the product's own prices unchanged.
  - Pure and unit-tested.
- **Stock:**
  - `seedOptionOnHand(productId, index)` mirrors `seedSizeOnHand`, with its own seed so tiers differ.
  - A fixed override guarantees that at least one product has an out-of-stock tier and one has a low tier (spec FR-3).

## 3. Seeding and the reseed remap (`db/seed.ts`, `db/database.ts`)

### Problem found in discovery

- Reseeding drops or deletes `product_variants`. Its ids are reassigned, but `cart_lines.variant_id`, `order_lines.variant_id` and `inventory_log.variant_id` keep the old ids.
- Inserting option variants between sized products shifts every later size id. So without a fix, the upgrade to v3 would silently move cart lines to the wrong sizes.
- `seed-cli` on an existing database also cascades away sized cart lines, because `cart_lines` has `ON DELETE CASCADE`.

### Fix

1. Before the seeded tables are dropped (on a version bump) or deleted (when the seed runs), the old variants are copied to a `variant_remap (id, product_id, label)` table.
2. The seed then runs with foreign keys off. After inserting, it remaps in one transaction:
   - Cart, order and inventory-log variant ids are remapped by `(product_id, label)`. The remap is two-phase (negate, then flip) so the unique cart-line index never collides mid-update.
   - Cart lines whose label no longer exists are deleted.
   - Cart lines and order lines with a null variant whose product now has options move to the base tier (spec FR-16). Order lines with a size snapshot are untouched.
   - `inventory.reserved` is rebuilt from live holds: pending-payment orders whose hold has not been released. Holds therefore survive a reseed instead of being forgotten.
3. Finally, `variant_remap` is dropped.

## 4. API

- **Shared types:**
  - `ProductSummary.hasOptions`;
  - `ProductOption { label, pricePaise, mrpPaise, discountPercent, availability }`;
  - `ProductDetail.options`;
  - `CartLineView.option`, `unitPricePaise` and `unitMrpPaise`;
  - `OrderLine.option`;
  - simulation units gain `kind`;
  - `RecommendedProduct.needsOption`.
- **Catalog repository:**
  - `PRODUCT_SELECT` adds `has_options`;
  - the existing sizes query filters `kind = 'size'`, and a new options query returns tier prices and availability.
- **Cart:**
  - `addToCartSchema` gains `option` (same bounds as `size`).
  - The unit is resolved by label within the matching kind.
  - New errors `OPTION_REQUIRED` / `INVALID_OPTION`.
  - Line prices come from `COALESCE(v.price_paise, p.price_paise)`.
- **Orders:** the order-line snapshot uses the cart line's unit prices and its `option` label. The quote already sums cart line prices.
- **Payments, lifecycle, merge:** these already work per `(product_id, variant_id)` and need no change beyond the label in views.
- **Recommendations:** `needsOption` sits alongside `needsSize`. The bundle add on the main product passes the page's selected option.
- **Simulation Console:** the unit query returns `kind`. The web shows "Option" or "Size".

## 5. Web

- **`OptionSelector`:**
  - a radio group like `SizeSelector`, labelled "Storage" or "Configuration" from the category;
  - each button shows the label and its price.
- **`useSelectedOption`:**
  - reads `?option=`;
  - falls back to the cheapest in-stock tier (D2);
  - writes the URL with `replace`.
- **Product page:** the price, the offer banner (from the tier price), the availability line, Add to cart and the pairing "Add both" use the selected tier.
- **`Price`:** gains a `from` prop. Cards, the typeahead, the wishlist and rails pass `hasOptions` (D3).
- **Line views:** a small `unitLabel(line)` helper renders "Size: M" or "256 GB" in the cart, checkout, payment, confirmation, the order page, the return dialog and the console.
- **Cart:** the line price uses `unitPricePaise`. Product links carry `?option=` or `?size=`.
- **Wishlist:** "Add to cart" opens the option picker for products with options. The cheapest in-stock tier is preselected.

## 6. Tests

See `test-plan.md`.
