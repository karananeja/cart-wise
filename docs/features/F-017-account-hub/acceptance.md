# Acceptance

**Feature:** F-017 — Account overview hub
**Status:** Pending user sign-off (Gate 2)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Latest order with status, date, amount, thumbnails; opens the order | Pass | Component; E2E |
| 2 | Empty orders/address/wishlist tiles with links; no recently viewed | Pass | Component; screenshot |
| 3 | Default address and wishlist count match their pages | Pass | Same queries as those pages; component |
| 4 | "Member since" shows the creation month | Pass | Component ("Mar 2026"); API |
| 5 | Desktop sidebar on overview, orders and addresses with current item marked; none at 360 px, nothing overflows | Pass | Component; E2E; screenshots (no horizontal scroll) |
| 6 | Orders failure → only that tile shows an error with Retry | Pass | Component |
| 7 | Sign out from header and sidebar | Pass | Sidebar and profile buttons use the existing sign-out; header unchanged |

## 2. Test results summary

- `pnpm test`: 551 passing (shared 75, API 276, web 200). The 7 new account tests replace 2 old ones.
- `pnpm e2e`: 59 passing, 1 of them new.
- Typecheck clean.

## 3. Known issues and limitations

- The Wishlist page isn't under `/account`, so it has no sidebar. The spec only asked for the sidebar on the overview, orders and addresses pages.

## 4. Deviations from the approved specification

- **Sign out in the profile card too,** not only in the sidebar: phones have no sidebar, and the spec's FR-1 asked for it in the header.
- **"Add address" from the overview returns to the overview** after saving.

## 5. Documentation updated

- [x] technical-design, test-plan, conversation-log

## 6. User sign-off (Gate 2)

- [ ] Accepted by user — date:
