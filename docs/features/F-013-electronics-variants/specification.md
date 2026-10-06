# Feature Specification

## Feature

**ID:** F-013
**Name:** Electronics variants — storage and memory options with their own prices
**Status:** Proposed — awaiting Gate 1
**Requirements:** PDP-3 (variants where the catalog supports them), brief §6 (variants); backlog item from the F-012 Gate 2 review

**User decisions applied (2026-10-06):**
- Phones and tablets offer **storage** options.
- Laptops offer **RAM + storage** configurations.
- Price **steps up with each tier**.
- **No colour** options.
- Mobile accessories and watches **stay unchanged**.

---

## 1. Objective

Let shoppers choose a storage or memory configuration for phones, tablets and laptops. Each configuration has its own price and its own stock, and that choice carries through cart, checkout, payment and orders.

## 2. User Problem

Real phones, tablets and laptops are sold in configurations at different prices. Today each one is a single fixed item. That makes the store feel unrealistic and hides a decision shoppers expect to make.

## 3. User Intent

"Show me the configurations, what each costs, and whether it's in stock, then let me buy the one I picked."

## 4. User Stories

- As a shopper, I want to see the available storage (or RAM + storage) options and the price of each.
- As a shopper, I want the price, offer and availability to update when I pick an option.
- As a shopper, I want my cart, checkout and order to show exactly which configuration I bought and what it cost.
- As a shopper browsing listings, I want to know the starting price.

## 5. Functional Requirements

### 5.1 Options

- FR-1 These categories get application-owned options. DummyJSON does not provide them (ADR-002: the application owns them, as with sizes).

  | Category | Option type | Tiers (base first) | Price step over base (proposed) |
  |---|---|---|---|
  | smartphones (16 products) | Storage | 128 GB · 256 GB · 512 GB | base · +10% · +25% |
  | tablets (3) | Storage | 64 GB · 128 GB · 256 GB | base · +12% · +25% |
  | laptops (5) | RAM + storage, one combined choice | 8 GB · 256 GB · 16 GB · 512 GB · 32 GB · 1 TB | base · +15% · +35% |

  - The tiers and steps are a **decision for the user** (§22, D1).
  - The base tier keeps today's catalog price.
  - Every tier keeps the product's discount percentage, so the MRP steps up by the same ratio.
  - Prices are rounded to the rupee.
- FR-2 All other categories, including mobile accessories and watches, are unchanged. Apparel and footwear keep their sizes. No product has both sizes and options.
- FR-3 Each tier is its own sellable unit with its own stock, held per tier just as stock is held per size.
  - Stock is seeded deterministically.
  - At least one product has an out-of-stock tier and one has a low-stock tier, so those states can be demonstrated.

### 5.2 Product page

- FR-4 The purchase panel shows an option selector: one button per tier, labelled with the configuration and its price (e.g. "256 GB · ₹29,600").
  - It is a labelled radio group.
  - Out-of-stock tiers stay visible, struck through, and cannot be selected.
- FR-5 **Preselection (D2, proposed):** the cheapest in-stock tier is selected when the page opens. The selection is kept in the URL, so it survives reloads and shared links.
  - An invalid or out-of-stock tier in the URL is ignored and the default applies.
  - When every tier is out of stock, the product shows "Out of stock" with nothing selected.
- FR-6 Price, MRP, discount, the card-offer banner and the availability line ("Only N left in 256 GB") all follow the selected tier.
- FR-7 Add to cart adds the selected tier. After adding, the in-place quantity stepper (F-004) applies to that tier, and switching tiers shows that tier's own cart state.

### 5.3 Listings, search and discovery

- FR-8 **Card price (D3, proposed):** product cards, search typeahead, wishlist and suggestion rails show "From ₹X", the lowest-priced tier.
  - The MRP and discount on cards are the base tier's.
- FR-9 Price filter, price sorting, the price facet range and discount sorting use the lowest tier price. A phone appears for a price range that includes its starting price.
- FR-10 Card availability is the total across tiers. This is the existing rule for sized products (F-003 FR-11).
- FR-11 Recommendations treat a product with options like a sized product:
  - Price similarity uses the starting price.
  - In a pairing group, a companion with options shows "Choose option" instead of being added blindly. Phones appear as companions of mobile accessories.
  - When the main product has options, "Add both" uses the tier selected on the page.

### 5.4 Cart, checkout, payment, orders

- FR-12 A cart line is one tier.
  - It shows the configuration ("256 GB") where sizes show "Size: M".
  - It is priced at that tier's current price, and it links back to the product with that tier selected.
  - The same product in two tiers makes two lines. Per-line limits (10) and stock checks apply per tier.
- FR-13 Guest-to-account cart merge, stock holds, payment and order lines work per tier, as they already do per size.
  - Order lines snapshot the tier label and the tier price.
  - Refunds use the snapshotted line price (unchanged rule).
- FR-14 Checkout, payment, confirmation, the order page, the return dialog and the Simulation Console show the configuration label. The console labels it "Option", not "Size", for these products.
- FR-15 The wishlist stays product-level (F-005). "Add to cart" from the wishlist asks for an option, the way it asks for a size today, with the same preselection rule as FR-5.

### 5.5 Existing data

- FR-16 After the upgrade:
  - Existing cart lines for phones, tablets or laptops move to the base tier at the base price, which equals the price they showed before. Quantities are capped by that tier's stock as usual.
  - Past orders are unchanged and show no configuration.
  - Existing size lines keep their size.

## 6. Non-Functional Requirements

- Performance: no additional request on the product page. Options come with the product detail.
- Accessibility: radio group, announced price and availability changes, keyboard operable.
- Responsive: options wrap at 360 px with no horizontal scroll.
- Reliability: prices are always computed on the server. The client never sends a price.

## 7. UX Requirements

- Primary action is unchanged: Add to cart, with a tier already chosen (D2).
- Options are visible up front with their prices, so the shopper doesn't have to click around to compare.
- No authentication changes.

## 8. UI Requirements

- Components:
  - OptionSelector, a sibling of SizeSelector built on the same radio pattern;
  - "From" price on cards;
  - configuration labels on lines.
- States: tier in stock / low stock / out of stock, and all tiers out of stock.

## 9. Data Requirements

| Entity | Change | Ownership |
|---|---|---|
| ProductVariant | Gains `kind` (`size` / `option`), `price_paise` and `mrp_paise` (null for sizes, which use the product price) | Application, seeded |
| Inventory | Unchanged (per unit) | Application |
| Cart / order lines | Unchanged columns; the existing `size` snapshot column stores the configuration label | Application |
| Product | `price_paise` / `mrp_paise` hold the lowest tier (the starting price) | Catalog snapshot + application |

Schema version 3 rebuilds the seeded tables. User tables that reference variants are remapped by label so they never point at the wrong unit (this also closes a latent reseed issue found during discovery).

## 10. API Requirements

- `GET /api/products/:slug` adds `options: { label, pricePaise, mrpPaise, discountPercent, availability }[]`, empty for products without options. `sizes` is unchanged.
- Product summaries add `hasOptions: boolean`, so cards can show "From".
- `POST /api/cart` accepts the selected option in the existing unit field.
  - It returns `OPTION_REQUIRED` / `INVALID_OPTION`, mirroring the size errors.
  - Cart line views include the unit label and unit price.
- Other endpoints return the per-line label and price they already carry.

## 11. State Management

- The URL holds the selected option, as it does for size.
- Server state is through the existing queries. No new global state.

## 12. Loading States

Unchanged. The options load with the product. The selector reserves its space so the page doesn't shift.

## 13. Empty States

Products without options show no selector.

## 14. Error States

- The selected tier sold out between page load and add: the add returns the existing stock error, and the selector refreshes.
- Invalid option: the shopper sees "Please choose an option"; no raw error is shown.

## 15. Security Considerations

The server computes the price from the unit. A tampered option label is rejected.

## 16. Analytics

No new events.
- `cart_item_added` / `cart_item_removed` carry the option label and the tier price.
- `product_viewed` carries the starting price.
- `filter_applied` is unchanged.

## 17. Acceptance Criteria

1. A phone shows 128 / 256 / 512 GB with prices stepping up as agreed. A tablet shows its storage tiers. A laptop shows RAM + storage configurations. Accessories, watches and apparel are unchanged.
2. The cheapest in-stock tier is preselected and kept in the URL. An invalid or out-of-stock tier in the URL is ignored. Out-of-stock tiers are visible and not selectable.
3. Price, MRP, discount, offer banner and availability follow the selected tier.
4. Cards, search typeahead, wishlist and rails show "From ₹X". Price filter and sort use the starting price.
5. Adding two tiers of one product creates two cart lines, each priced at its tier. Limits and stock apply per tier.
6. Checkout, payment, confirmation, the order page and returns show the configuration and charge or refund the tier price. Stock holds and expiry release work per tier.
7. Guest cart merge on sign-in combines lines of the same tier only.
8. Existing carts with these products land on the base tier at the same price. Past orders still display correctly.
9. Pairing groups show "Choose option" for companions with options. "Add both" on a phone page adds the selected tier.
10. The Simulation Console lists each tier as its own unit, labelled "Option".
11. Keyboard and screen reader use works, with no horizontal scroll at 360 px.

## 18. Testing Strategy

- **Unit:**
  - tier pricing (steps, rounding, discount kept);
  - seeding (determinism, out-of-stock and low-stock tiers);
  - starting price.
- **API:**
  - product detail options;
  - listing filter and sort on the starting price;
  - cart add with an option, `OPTION_REQUIRED`/`INVALID_OPTION`, two tiers as two lines;
  - checkout, payment and refund amounts per tier;
  - merge per tier;
  - schema 3 upgrade remapping existing cart lines.
- **Component:**
  - OptionSelector states and URL sync;
  - "From" price;
  - cart line label;
  - wishlist option picker.
- **E2E:**
  - choose a non-base tier → add → checkout → pay → the order shows the tier and its price;
  - existing E2E tests that use laptops and phones are updated for the preselected tier.

## 19. Dependencies

F-003 (sizes, units), F-004 (cart), F-005 (wishlist), F-008/F-009/F-010 (holds, payment, orders), F-011 (console), F-012 (pairing, rails).

## 20. Out of Scope

- Colour options.
- Options for accessories or watches.
- Separate RAM and storage selectors.
- Per-tier images.
- Per-tier reviews.
- Comparing tiers side by side.
- Trade-in.

## 21. Assumptions

- Tiers are per category, not per model. An older phone gets the same three storage tiers as a new one; this is a simulation.
- Today's price becomes the base-tier price, so nothing a shopper has already seen gets cheaper.
- Card offers already apply to the order total, so a pricier tier can unlock a bigger offer. This is intended.

## 22. Decisions Required From User

- **D1 — Tiers and price steps:** accept the table in FR-1, or change the tiers or percentages.
- **D2 — Preselection:** preselect the cheapest in-stock tier (recommended: the shopper always sees a concrete price and can add in one tap; unlike sizes, any tier is a valid choice), or require a choice as sizes do.
- **D3 — Card price:** "From ₹X" (recommended: honest when tiers cost more), or the base price without "From".
