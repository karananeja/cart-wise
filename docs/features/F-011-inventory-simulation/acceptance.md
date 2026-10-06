# Acceptance

**Feature:** F-011 — Store Simulation Console: inventory simulation
**Status:** Pending user sign-off (Gate 2)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `/sim` has Orders and Inventory tabs behind the operator password; Orders unchanged | Pass | E2E (tabs, `aria-current`; the F-010 orders E2E still passes); `SimOrders.test.tsx` |
| 2 | Search and the Low stock / Sold out filters; on hand, held, available and status; per-size rows | Pass | API (search, product-level filters, sized units, paging); `SimInventory.test.tsx` |
| 3 | −, + and an exact value change real stock; the storefront and cart react | Pass | API (availability changes: low at 4, sold out at 0); E2E (− then 0 → product page sold out, cart flags the line) |
| 4 | On hand can't go below held | Pass | API (`409 BELOW_HELD { held }`, unchanged); component test (− disabled at held, alert) |
| 5 | Auto decrease: 1–3 available units −1 each; never held or below zero | Pass | API with a seeded random source (only available units, held untouched, nothing available → no change) |
| 6 | Auto restock: up to 3 low or sold-out units refilled to the seeded level, at least 10 available | Pass | API (unsized and sized targets checked against the seed functions, held added on top); E2E (0 → restocked, in stock again) |
| 7 | Settings persist, off by default; Run once now; next tick shown | Pass | API (new app on the same database keeps the settings; `AUTOMATION_OFF` when both are off); scheduler unit tests (no timer when off, interval, reschedule); E2E ("Next tick in Ns", disabled Run once now) |
| 8 | Log of the last 20 changes, with source, before and after | Pass | API (20 shown, newest first); E2E (Manual and Auto restock entries) |
| 9 | No urgency messaging on the storefront | Pass | No storefront changes in this feature; it uses the existing availability states |
| 10 | Operator session required; keyboard, screen reader and 360 px work | Pass | API (401 on every inventory route); named steppers and switches; E2E mobile (no horizontal scroll) |

## 2. Test results summary

- 401 unit, API and component tests (shared 38, API 215, web 148).
- 46 E2E tests, 3 of them new, passing on 11 consecutive full runs.
- Typecheck and build clean.

## 3. Known issues and limitations

- **Automation needs a running API.** Ticks happen only while the API is running; missed ticks are not replayed.
- **Restock ignores reason codes.** Restock refills to the seeded level whatever the item's history.
- **Rare intermittent E2E failure, not reproduced.** One full E2E run, during F-011 testing, failed the F-009 test "a declined card fails…; retrying with another card succeeds" on a visibility check. It did not recur in the next 8 full runs or the 3 before it, and the cause wasn't identified. If it recurs, the trace in `test-results/` should be examined.

## 4. Deviations from the approved specification

None.

## 5. Other changes

- **Simulation spec runs alone:** Playwright now runs `e2e/simulation.spec.ts` as its own project after all other specs. Automatic restock picks random low-stock items and could otherwise refill a product another spec set low.
- **Operator sign-in moved:** the operator sign-in moved into a shared console layout (`SimConsole`), so both tabs use it.
- **README:** describes the Inventory tab and the persisted automation switches.

## 6. Documentation updated

- [x] specification.md, intent.md, technical-design.md, test-plan.md, conversation-log.md
- [x] project-plan, project-state, conversation log, README

## 7. User sign-off (Gate 2)

- [ ] Accepted by user — date:
