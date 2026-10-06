# Acceptance

**Feature:** F-004 — Guest cart
**Status:** Pending user sign-off (Gate 2)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Unsized add: count 0 → 1, "Added to cart · View cart", button → Go to cart | Pass | `AddToCart.test.tsx`; E2E |
| 2 | Sized without size: prompt, focus, nothing added; with size: line shows size | Pass | `AddToCart.test.tsx`; `cart.test.ts` (`SIZE_REQUIRED`); E2E |
| 3 | Sold-out product/size: disabled Out of stock | Pass | `AddToCart.test.tsx` |
| 4 | Cart lines and summary (Items, MRP, Discount, Subtotal, delivery note) correct | Pass | `CartPage.test.tsx` totals; `cart.test.ts` server totals |
| 5 | +/− immediate; limit = min(10, stock) with reason; server enforces | Pass | `CartPage.test.tsx` (stock and 10 caps); `cart.test.ts` (409/400 on bypass) |
| 6 | Remove + Undo restores size and quantity | Pass | `CartPage.test.tsx`; E2E |
| 7 | Survives reload; other browsers have their own cart | Pass | E2E reload and second browser context; `cart.test.ts` isolation |
| 8 | Same product and size twice → one line, quantity 2 | Pass | `cart.test.ts` (including the unsized NULL-size case) |
| 9 | Stock drop: flagged lines, attention notice, excluded from subtotal, nothing removed | Pass | `cart.test.ts`; `CartPage.test.tsx`; E2E with a real stock change |
| 10 | Empty cart state | Pass | `CartPage.test.tsx` |
| 11 | `cart_item_added` / `cart_item_removed` with properties | Pass | `AddToCart.test.tsx`; `CartPage.test.tsx` (including the undo source) |
| 12 | Failure rolls back with message; offline read-only; no raw errors | Pass | `CartPage.test.tsx` (rollback, load error); offline notice and disabled controls by inspection |
| 13 | Keyboard operable, steppers announce quantity, 360 px | Pass | Labelled button groups with `output` live regions; E2E mobile |

## 2. Test results summary

192 unit/API/component tests; 21 E2E tests passing on 3 repeated runs; typecheck and build clean. Details in `test-plan.md`.

## 3. Known issues and limitations

- No Proceed to checkout yet (by design; arrives with F-006/F-008).
- Stock is not reserved while in the cart (Q10, decided with checkout).
- Re-seeding the catalog (`pnpm db:seed`) empties carts, because product sizes are recreated.
- Offline behaviour is covered by inspection and the shared offline banner, not by an automated test.

## 4. Deviations from the approved specification

None.

## 5. Documentation updated

- [x] specification.md, intent.md, technical-design.md, test-plan.md
- [x] project-state.md, project-plan.md, conversation logs

## 6. User sign-off (Gate 2)

- [ ] Accepted by user — date:
