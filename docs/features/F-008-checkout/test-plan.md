# Test Plan

**Feature:** F-008 — Checkout

## 1. Scope

Delivery rules, quote, order creation with atomic stock holds, cancel and expiry release, ownership, the cart's own-hold availability, the checkout page (sections, selections, sign-in gate, add-address return), the payment hold page, analytics, and mobile layout.

## 2. Risk areas

- Overselling the last unit; partial reservations
- Releasing stock twice, or never
- Prices changing between quote and payment
- Choices lost across sign-in and add-address round trips
- Mobile overflow from long product titles

## 3. Tests

| Level | Area | File |
|---|---|---|
| Unit | delivery pricing, shortfall, estimates | `packages/shared/src/checkout.test.ts` |
| API | quote blockers and totals; order creation (locked prices, hold 10 min, others see less, own cart unaffected); exact-size hold; all-or-nothing; last unit to one customer; refusals; one pending per customer; cancel releases once; expiry releases once (injected clock); ownership | `apps/api/src/orders/orders.test.ts` |
| Component | guest gate; Proceed disabled with problems; preselection and summary; Express switch; change address; no address; continue → payment → cancel; cart changed; expired hold; unknown order | `apps/web/src/features/checkout/Checkout.test.tsx` |
| E2E | guest cart → sign up → add address (returns selected) → Express → payment hold visible to another shopper → cancel releases, cart intact; mobile bottom bar and width | `e2e/checkout.spec.ts` |

## 4. Manual verification

Screenshots on preview ports: desktop checkout, payment page with countdown, mobile checkout. No console errors.

## 5. Results

| Run date | Command | Result | Notes |
|---|---|---|---|
| 2026-10-06 | `pnpm test` | 296 passed (shared 22, api 166, web 108) | Checkout component tests stable over 4 runs |
| 2026-10-06 | `pnpm e2e --repeat-each=3 --workers=2` | 102 passed (34 × 3) | |
| 2026-10-06 | `pnpm typecheck`, `pnpm build` | Clean / succeeds | |

### Defects found and fixed during testing

- **Order lines and sizes:** order lines were matched to their size by product and quantity (ambiguous for two sizes of the same product); they now match by cart line id. Caught in code review before testing.
- **Delayed radio selection:** the delivery radio lagged because it followed the server quote, and URL updates are deferred transitions. Choices now update instantly in state and are mirrored to the URL. Found by E2E.
- **Mobile overflow:** checkout and payment were 393 px wide on a 360 px screen, because grid columns couldn't shrink below long product titles. Fixed with `min-w-0`. Found by E2E.
- **Copy:** the interim payment note mentioned "the next step of this project"; it now reads "Payment options will appear here."
- **Test-only:** buttons duplicated in the summary and the mobile bar, section names, and a too-fast double navigation.
