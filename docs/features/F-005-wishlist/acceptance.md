# Acceptance

**Feature:** F-005 — Wishlist
**Status:** Pending user sign-off (Gate 2)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Heart on product page and cards saves/removes; header count; hearts agree; card heart doesn't navigate | Pass | `Wishlist.test.tsx`; E2E |
| 2 | Wishlist page newest first, current price/availability | Pass | `Wishlist.test.tsx`; `wishlist.test.ts` |
| 3 | Move unsized to cart → removed from wishlist, "Moved … · View cart" | Pass | `Wishlist.test.tsx` |
| 4 | Move sized → size picker with sold-out disabled → added, removed | Pass | `Wishlist.test.tsx`; E2E on seeded data |
| 5 | Failed move keeps item with reason | Pass | `Wishlist.test.tsx` (sold out) |
| 6 | Cart line → wishlist; Undo restores line | Pass | `Wishlist.test.tsx`; E2E |
| 7 | Out-of-stock products saveable; Out of stock instead of Move to cart | Pass | `Wishlist.test.tsx`; `wishlist.test.ts` |
| 8 | Idempotent save; 101st refused with message | Pass | `wishlist.test.ts`; `Wishlist.test.tsx` (full message and rollback) |
| 9 | Survives reload; per browser | Pass | E2E reload; `wishlist.test.ts` isolation |
| 10 | Empty state | Pass | `Wishlist.test.tsx` |
| 11 | `wishlist_added` / `wishlist_removed` with sources | Pass | `Wishlist.test.tsx` (product_card, moved_to_cart; cart_item_added source wishlist) |
| 12 | Failures roll back; offline disables; no raw errors | Pass | Rollback test; offline-disabled controls by inspection |
| 13 | Named toggle buttons with `aria-pressed`; focus-trapped dialog; 360 px | Pass | Tests query by role and pressed state; Radix Dialog; E2E mobile |

## 2. Test results summary

209 unit/API/component tests; 24 E2E tests passing on 3 repeated runs; typecheck and build clean.

## 3. Known issues and limitations

- **Offline:** offline behaviour is verified by inspection only.
- **Saved prices:** prices on the wishlist are current. There are no price-drop or back-in-stock alerts (Phase 2).
- **Bottom-anchored dialog:** on phones the size picker is the Dialog anchored to the bottom of the screen, rather than a separate Sheet component. It behaves the same.

## 4. Deviations from the approved specification

None in behaviour.

## 5. Documentation updated

- [x] specification.md, intent.md, technical-design.md, test-plan.md
- [x] project-state.md, project-plan.md, conversation logs

## 6. User sign-off (Gate 2)

- [ ] Accepted by user — date:
