# Acceptance

**Feature:** F-012 — Product discovery
**Status:** Pending user sign-off (Gate 2)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | You may also like: same category, ranked by tags, brand and price; out of stock last; never itself | Pass | `rules.test.ts` (scores, ties, out-of-stock last, self excluded); API; E2E |
| 2 | Frequently bought together only after 2 or more real paid orders; otherwise Pairs well with from the map; unmapped categories show neither | Pass | API (flips after the 2nd paid order; an unpaid hold doesn't count; both directions; sports → none); E2E (2 orders → Frequently bought together) |
| 3 | Add both/all adds the ticked unsized items; sized items show Choose size; waits for the page size; partial failure named | Pass | `Discovery.test.tsx`; E2E (Add both/all → cart count) |
| 4 | Home: Still in your cart, Because you viewed, Because you bought (signed in with orders; excludes bought and cart items); first-time visitors unchanged | Pass | API; component tests; E2E |
| 5 | Cart rail below the checkout action, excluding cart items, hidden when empty | Pass | API; component test; E2E (rail positioned below Proceed to checkout) |
| 6 | `recommendation_clicked` with surface, kind, product and position; adds tagged `source: 'recommendation'` | Pass | Component tests (event payloads) |
| 7 | Never delays or displaces main content; failures hide the section | Pass | Fixed-height placeholders; component test (failure keeps the product page intact) |
| 8 | Keyboard, screen reader, 360 px | Pass | Labelled regions and checkboxes; E2E mobile (no horizontal scroll); screenshots at 360 px |

## 2. Test results summary

- 465 unit, API and component tests (shared 38, API 226, web 165).
- 49 E2E tests, 3 of them new, passing on 8 consecutive full runs.
- Typecheck and build clean; main bundle 413 kB.

## 3. Known issues and limitations

- **Pricey companions:** "Pairs well with" ranks companions by rating first. For a phone it can suggest a premium accessory (AirPods Max, ₹45,581, next to a ₹63,442 phone) rather than a cheap one. This is the approved rule; a price cap for companions would be a product change.
- **One companion for single-category mappings:** smartphones, tablets and laptops map to one complementary category, so they get one companion (at most one per category).
- **Rare co-purchases in demos:** "Frequently bought together" appears only once real paid orders exist, so it is rare in a fresh database.

## 4. Deviations from the approved specification

- **FR-8, clarified:** with no companion ticked, the pairing group shows "Tick an item to add them together" and no button, instead of a second "Add to cart". The original wording caused two identically named buttons on the page, which confuses screen-reader users and broke the existing cart E2E test. Recorded in the spec.

## 5. Other changes

- **Homepage headings:** the homepage now starts with a visually hidden `h1` (the store name), and "Shop by category" is an `h2`. The new sections sit above it, so the headings are in order.
- **Size selection:** product-page size selection moved into a small `useSelectedSize` hook, so the pairing group can read it.
- **One-off checkout E2E failure:** the checkout mobile E2E test failed once, in the same run as the duplicate-button regression, and has passed in all 8 runs since. Its cause wasn't confirmed.

## 6. Documentation updated

- [x] specification.md (FR-8 clarification), intent.md, technical-design.md, test-plan.md, conversation-log.md
- [x] project-plan, project-state, conversation log

## 7. User sign-off (Gate 2)

- [ ] Accepted by user — date:
