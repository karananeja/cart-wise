# Test Plan

**Feature:** F-005 — Wishlist

## 1. Scope

Wishlist API (save, remove, cap, cookie, isolation, expiry), hearts on cards and the product page, the header count, the wishlist page with both move paths, cart Move to wishlist, analytics, and mobile layout.

## 2. Risk areas

- Hearts out of sync across the page
- Card heart clicks also opening the product (stretched link)
- Move to cart partial failures (added but not removed, or the reverse)
- Cap and idempotency

## 3. Tests

| Level | Area | File |
|---|---|---|
| API | save/remove idempotent, cookie, isolation, cap, unknown product, expiry, fresh prices | `apps/api/src/wishlist/wishlist.test.ts` |
| Component | toggle sync and rollback; card heart doesn't navigate; wishlist page moves (unsized/sized/failure); empty state; cart Move to wishlist with Undo; analytics | `apps/web/src/features/wishlist/*.test.tsx` |
| E2E | save from card and product page; move sized to cart; cart → wishlist; reload; mobile | `e2e/wishlist.spec.ts` |

## 4. Manual verification

Screenshots on the preview ports (5274/3201): cards with hearts, wishlist page, size picker, at 1280 and 375 px.

## 5. Results

| Run date | Command | Result | Notes |
|---|---|---|---|
