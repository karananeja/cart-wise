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
