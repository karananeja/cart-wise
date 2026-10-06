# Test Plan

**Feature:** F-004 — Guest cart

## 1. Scope

Cart rules, endpoints and cookie identity, expiry, product-page add flow, cart page interactions, optimistic updates and rollback, stock-change issues, analytics, persistence, and mobile layout.

## 2. Risk areas

- Limits enforced by the server, not only the UI
- Duplicate lines for unsized products (NULL uniqueness)
- Out-of-order responses on rapid quantity changes
- Cross-cart access via line ids
- Totals including lines with issues

## 3. Tests

| Level | Area | File |
|---|---|---|
| Unit | rules: max quantity, issues, totals, ordering | `apps/api/src/cart/rules.test.ts` |
| API | endpoints, errors, cookie, isolation, idempotent add, unsized uniqueness, expiry | `apps/api/src/cart/cart.test.ts` |
| Component | AddToCartButton states; cart page stepper, limits, remove/undo, issues, rollback, empty; header badge; analytics | `apps/web/src/features/cart/*.test.tsx` |
| E2E | add sized and unsized, quantity, remove/undo, reload persistence, stock drop, mobile | `e2e/cart.spec.ts` |

## 4. Manual verification

Screenshots of the product page after adding, the cart with an issue, and the empty cart at 1280 and 375 px.

## 5. Results

| Run date | Command | Result | Notes |
|---|---|---|---|
| 2026-10-06 | `pnpm test` | 192 passed (shared 16, api 107, web 69) | |
| 2026-10-06 | `pnpm e2e --repeat-each=3 --workers=2` | 63 passed (21 tests × 3) | All feature suites; cart stock-drop test edits the E2E database directly |
| 2026-10-06 | `pnpm typecheck`, `pnpm build` | Clean / succeeds | |
| 2026-10-06 | Manual (screenshots) | Pass after fixes | Size prompt, added state, cart desktop and mobile, mobile menu; no console errors |

### Defects found and fixed during testing

- Schema edit dropped the `analytics_events` CREATE statement (caught immediately by the API tests).
- Mobile header wrapped to three rows once the cart icon was added. "All products" now moves into the Categories menu below 640 px.
- On mobile, the cart line total sat directly above the unit price and looked duplicated at quantity 1. It now sits beside the quantity controls.
- Test-only: an expected price rounding (₹8.94, not ₹8.95) and a cart-link matcher that also matched the "Cartwise" logo.
