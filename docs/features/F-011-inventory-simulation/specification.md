# Feature Specification

## Feature

**ID:** F-011
**Name:** Store Simulation Console — inventory simulation
**Status:** Draft — awaiting Gate 1
**Requirements:** SIM-1, SIM-2, INV-1, INV-3, STATE-1. SIM-3 and SIM-4 were delivered in F-010.

**User decisions applied (2026-10-06):**
- **Automatic decrease:** each tick, 1–3 random sellable units with stock available lose 1 unit each. Held (reserved) units are never touched, and stock never goes below zero.
- **Automatic restock:** each tick, up to 3 items with 5 or fewer available (including sold out) are refilled to their original seeded level, at least 10.
- **Settings:** both switches are off by default. The interval is 10 s, 30 s, 60 s (default) or 5 min. Settings are saved in the database and survive API restarts.
- **Layout:** one console with **Orders** and **Inventory** tabs behind the F-010 operator password. Inventory includes a log of the last 20 simulated changes.

---

## 1. Objective

Let the demo operator change the store's real inventory, by hand or automatically over time, so stock states can be demonstrated end to end:
- in stock, low stock and sold out;
- cart lines that need attention;
- items coming back.

## 2. User Problem

The operator can't currently show what happens when stock runs low, sells out or comes back without editing the database.

## 3. User Intent

"Let me make stock move — one product at a time, or on its own — and see the store react honestly."

## 4. User Stories

- As an operator, I want to find a product and set its stock, per size where it has sizes.
- As an operator, I want stock to drain slowly on its own, as if other customers were buying.
- As an operator, I want low and sold-out items to refill on their own.
- As an operator, I want to see what the simulation just changed.

## 5. Functional Requirements

### 5.1 Console layout

- FR-1 `/sim` has two tabs, **Orders** (the F-010 page, unchanged) and **Inventory**, each with its own URL (`/sim/orders`, `/sim/inventory`). Both share the F-010 operator sign-in, the "Demo operator — simulation only" banner and Sign out. `/sim` opens Orders.

### 5.2 Manual stock (SIM-1)

- FR-2 The Inventory tab lists products, 20 per page with **Show more**. It has:
  - a search by product name;
  - a filter: All, Low stock (1–5 available), Sold out.
- FR-3 **Each row** shows the product, its category, **On hand**, **Held** (reserved by checkouts), **Available** (on hand minus held) and the status (In stock, Low stock, Sold out). Products with sizes expand to one row per size; the product row shows the totals.
- FR-4 **Changing stock.** Each sellable unit (a product without sizes, or one size) has **−** and **+** buttons and an exact value field (0–999).
  - On hand can never go below the units held, because those are promised to a customer in checkout. At that point − is disabled, with "N held in checkout".
  - Each change saves immediately and is logged (FR-9).
- FR-5 **Effects.** Changes are the application's real inventory (INV-1), so the storefront reflects them as soon as it next loads:
  - availability and the low-stock and sold-out states (INV-3);
  - cart lines that need attention (F-004);
  - checkout being blocked (F-008).

  Existing holds and paid orders are unaffected.

### 5.3 Automation (SIM-2)

- FR-6 The **Simulation** panel has:
  - **Automatic decrease**: on/off;
  - **Automatic restock**: on/off;
  - **Interval**: 10 s, 30 s, 60 s or 5 min;
  - a **Run once now** button, which applies one tick of whatever is switched on immediately.

  Both switches are off by default. Settings are saved and survive API restarts. The panel shows when the next tick will run.
- FR-7 **Decrease tick.**
  - It picks 1–3 random sellable units with at least 1 available unit and lowers each by 1.
  - It never reduces held units and never goes below zero.
  - If nothing is available, the tick does nothing.
- FR-8 **Restock tick.**
  - It picks up to 3 random sellable units with 5 or fewer available, including sold out.
  - It sets their on-hand so that available equals the item's original seeded level, with a minimum of 10.
- FR-9 **Change log.**
  - The panel shows the last 20 stock changes, newest first, manual or automatic: time, product and size, before → after, and source (Manual, Auto decrease, Auto restock).
  - The log is stored, and older entries are pruned beyond 500.

### 5.4 Honesty (CLAUDE.md §13)

- FR-10 The simulation changes real stock numbers only. The storefront shows only the existing states derived from real inventory (In stock, Only N left, Sold out). No "selling fast", "N people are viewing" or similar urgency messages are added, and behavioural signals stay separate from inventory.

## 6. Non-Functional Requirements

- **Integrity:**
  - every change is a guarded single statement, so on hand can't go below held and the result is never negative;
  - automation and manual edits can interleave safely, because SQLite serialises writes;
  - automation runs in the API process only. In tests, ticks run through the service with a seeded random source.
- **Security:** every inventory route requires the operator session (F-010).
- **Accessibility:**
  - tabs and switches are keyboard-operable;
  - the − and + buttons are named "Decrease stock for X" and "Increase stock for X";
  - the log is a list;
  - changes are announced politely.
- **Responsiveness:** works at 360 px. Rows stack on mobile.

## 7. UX Requirements

- The operator can find a product in one search and change it in one tap.
- Automation status is always visible: on or off, the interval, and the next tick.
- Nothing on the storefront reveals that the operator console exists.

## 8. UI Requirements

- **Screens:** Simulation console (tabs), Inventory tab.
- **Components:** SimTabs, InventorySearch, InventoryRow (and size rows), StockStepper, SimulationPanel, ChangeLog.
- **States:** loading, empty search ("No products match"), error, offline (controls disabled), signed out (sign-in form).

## 9. Data Requirements

| Entity | Fields | Notes |
|---|---|---|
| Inventory | `on_hand` and `reserved` (existing) | No schema change |
| app_settings | `sim.autoDecrease`, `sim.autoRestock`, `sim.intervalSeconds` | Existing key/value table |
| InventoryLog | id, at, productId, variantId, title, size, fromOnHand, toOnHand, source (`manual` / `auto_decrease` / `auto_restock`) | Keeps the last 500 |

## 10. API Requirements

All routes require the operator session.

| Endpoint | Purpose |
|---|---|
| `GET /api/sim/inventory?q=&filter=all\|low\|sold_out&cursor=` | Products with per-size rows, 20 per page |
| `PUT /api/sim/inventory/units` | `{ productId, variantId \| null, onHand }` → updated row. Answers `409 BELOW_HELD` (with `held`) if below held, `400` if out of range |
| `GET /api/sim/automation` | Settings, next tick time, last 20 log entries |
| `PUT /api/sim/automation` | `{ autoDecrease, autoRestock, intervalSeconds }` |
| `POST /api/sim/automation/run` | One tick now → `{ changes }` |

## 11. State Management

- Server state:
  - the inventory query, keyed by search, filter and page;
  - the automation query, polled every 5 seconds while either switch is on, so the log and the next tick stay current.
- Local state: the search input, debounced.

## 12. Loading States

- Skeleton rows.
- Steppers show pending on the unit being changed.

## 13. Empty States

- "No products match".
- The log is empty until the first change: "No changes yet".

## 14. Error States

- `BELOW_HELD`: "N units are held in checkout — on hand can't go lower".
- Other failures: a message, and the value reverts.
- Offline: controls disabled.

## 15. Security Considerations

- The operator session is required (F-010).
- Inputs are validated: integer, 0–999, an existing unit.
- No customer data appears in this tab.

## 16. Analytics

N/A. Operator actions aren't customer behaviour.

## 17. Acceptance Criteria

1. `/sim` shows the Orders and Inventory tabs behind the operator password; Orders behaves as in F-010.
2. Search and the Low stock / Sold out filters find products. Rows show on hand, held, available and status. Sized products show per-size rows.
3. −, + and an exact value change real stock. The storefront product page and listing reflect the change on reload: low stock at 5 or fewer, sold out at 0, and cart lines flag the problem.
4. On hand can't be set below the units held in checkout.
5. With automatic decrease on, each tick lowers 1–3 available units by 1. Held units and zero stock are never touched.
6. With automatic restock on, each tick refills up to 3 low or sold-out units to their seeded level (at least 10 available).
7. Switches and interval persist across API restarts and are off by default. **Run once now** applies one tick. The next tick time is shown.
8. The log shows the last 20 changes with source, before and after.
9. No urgency messaging is added to the storefront.
10. All inventory routes refuse requests without the operator session. Keyboard, screen reader and 360 px work.

## 18. Testing Strategy

- **Unit:**
  - decrease and restock tick selection with a seeded random source: limits, never touching held units, never negative;
  - restock target (seeded level, minimum 10).
- **API:**
  - list (search, filters, sizes, paging);
  - set stock (bounds, below-held refusal, log entry);
  - automation settings persist across app instances on the same database;
  - Run once now;
  - operator-only access.
- **Component:**
  - Inventory tab: search, filter, stepper, below-held message;
  - Simulation panel: switches, interval, run once, log.
- **E2E:**
  - operator sets a product to 0 → the storefront shows Sold out and a cart with it flags the line;
  - restock with Run once now → it is back;
  - mobile.

## 19. Dependencies

F-010 (operator session and console). Uses inventory from F-001 and F-003, cart issues from F-004 and holds from F-008.

## 20. Out of Scope

- Price changes
- Adding or removing products
- Back-in-stock notifications (Phase 2)
- Inventory history charts
- Supplier and purchase orders
- Per-product automation rules
- Automatic order progression

## 21. Assumptions

- **Random source:** automation randomness doesn't need to be reproducible in normal running. Tests inject a seeded source.
- **Seeded level:** an item's "original seeded level" is computed from the same deterministic seed functions used at seeding (`seedOnHand`, `seedSizeOnHand`).
- **Single process:** the interval runs in the API process. If the API isn't running, no ticks happen; missed ticks are not replayed.

## 22. Decisions Required From User

None outstanding. Confirmed 2026-10-06: the decrease and restock rules, the settings behaviour, and one console with tabs and a log.
