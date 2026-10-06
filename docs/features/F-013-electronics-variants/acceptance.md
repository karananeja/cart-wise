# Acceptance

**Feature:** F-013 — Electronics variants
**Status:** Pending user sign-off (Gate 2)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Phones 128/256/512 GB, tablets 64/128/256 GB, laptops RAM + storage, prices stepping as agreed; accessories, watches and apparel unchanged | Pass | `options.test.ts`; API catalog test; screenshots |
| 2 | Cheapest in-stock option preselected and kept in the URL; invalid or sold-out option in the URL ignored; sold-out options visible and not selectable | Pass | `ProductOptions.test.tsx`; E2E |
| 3 | Price, MRP, discount, offer banner and availability follow the option | Pass | `ProductOptions.test.tsx` (price, MRP, "Only 2 left in 256 GB"); the offer banner is fed the option price |
| 4 | "From ₹X" on cards, search typeahead, wishlist and rails; filter and sort on the starting price | Pass | Card and wishlist component tests; API price filter; E2E sort |
| 5 | Two options of one product → two lines at their own prices; limits and stock per option | Pass | API cart test |
| 6 | Checkout, payment, confirmation, order page and returns show the option and charge or refund its price; holds per option | Pass | API checkout test; E2E journey (held 1 on 256 GB, then sold; 128 GB untouched) |
| 7 | Sign-in merge combines the same option only | Pass | API merge test |
| 8 | Existing carts land on the base option at the same price; past orders display correctly | Pass | Upgrade test; your `store.db` upgraded with all 5 cart lines intact |
| 9 | Pairing: "Choose option" for companions with options; "Add both" adds the selected option | Pass | `Discovery.test.tsx` |
| 10 | Console lists each option as its own unit, labelled "Option" | Pass | `SimInventory.test.tsx` |
| 11 | Keyboard, screen reader, 360 px | Pass | Native radio group with option and price in each label; quantity steppers name the option; E2E 360 px check |

## 2. Test results summary

- 453 unit, API and component tests (shared 38, API 241, web 174). That is 14 new API tests and 9 new web tests.
- 53 E2E tests, 2 of them new, passing on 3 consecutive full runs.
- Typecheck and build clean; main bundle 416 kB.

## 3. Known issues and limitations

- **Paise on base prices:** a base option keeps the exact catalog price (e.g. ₹1,21,792.41), while higher options are whole rupees (₹1,40,061). This follows the approved rule that today's price stays as it is.
- **Same tiers for every model:** an iPhone 5s offers 512 GB like an iPhone 13 Pro. Tiers are per category, as specified.
- **"From" counts sold-out options:** the starting price is the base option even when it is sold out. The product page then preselects the next in-stock option at its own price.
- **Card offers are often capped:** most phones and laptops already reach the ₹1,500 Aurora cap, so the banner rarely changes between options, though it always uses the selected price.

## 4. Deviations from the approved specification

- **§9 data, clarified:** the option label is stored in a new `order_lines.option_label` column, not in the existing `size` column. Past orders stay unambiguous without reading the (mutable) variants table. There is no behavior change.

## 5. Other changes

- **Reseed safety (found during discovery):**
  - Reseeding the catalog used to reassign variant ids without updating cart lines, order lines or the stock log.
  - Re-running `pnpm db:seed` cascaded away sized cart lines.
  - Holds were forgotten.
  - Seeding now remaps every reference by product and label, keeps cart lines, and rebuilds held stock from unpaid orders. Integration tests cover both paths.
- **Test products:** API tests that used the iPhone X as "a product without sizes" now use the Apple MagSafe Battery Pack. Phone-specific tests (recommendations, the stock-drop E2E) use phone options.

## 6. Documentation updated

- [x] specification.md, intent.md, technical-design.md, test-plan.md, conversation-log.md
- [x] project-plan, project-state, conversation log, backlog

## 7. User sign-off (Gate 2)

- [ ] Accepted by user — date:
