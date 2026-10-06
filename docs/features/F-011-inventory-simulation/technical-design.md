# Technical Design — F-011 Inventory simulation

**Status:** Implementation
**Inputs:** specification.md (approved 2026-10-06), ADR-002 (application inventory), F-010 operator session

## 1. Shared (`packages/shared/src/simulation.ts`)

- **Constants:**
  - `SIM_INTERVALS` (10, 30, 60, 300 seconds) and `DEFAULT_SIM_INTERVAL` (60);
  - `MAX_ON_HAND` (999);
  - the automation limits: up to 3 units per decrease or restock tick, and a restock floor of 10 available;
  - `INVENTORY_FILTERS`.
- **Types:**
  - `SimInventoryProduct` and `SimInventoryUnit`;
  - `SimInventoryPage`;
  - `InventoryChange`;
  - `SimAutomation`.

## 2. Data

```sql
inventory_log(id PK, at, product_id, variant_id NULL, title, size NULL, from_on_hand, to_on_hand, source)
  -- pruned to the latest 500 after each insert; no FK, so a catalog reseed doesn't break it
app_settings: sim.autoDecrease ('0'|'1'), sim.autoRestock ('0'|'1'), sim.intervalSeconds
```

## 3. API (`apps/api/src/sim/inventory.ts`)

The inventory simulation service takes the database, the clock and a random source (`random`, injectable for tests).

- **`list(q, filter, cursor)`:**
  - products ordered by title then id, with an offset cursor, 20 per page;
  - `q` matches the title (case-insensitive `LIKE`);
  - `filter` uses the product-level available total, as the storefront does: `low` means 1–5, `sold_out` means 0;
  - units are loaded for the page only.
- **`setOnHand(productId, variantId, onHand)`:**
  - a single guarded `UPDATE … SET on_hand = @v WHERE unit AND reserved <= @v`;
  - zero rows changed → `404 UNIT_NOT_FOUND` if the unit doesn't exist, otherwise `409 BELOW_HELD { held }`;
  - logs a `manual` change.
- **`tick({ decrease, restock })`:**
  - **decrease:**
    - k = 1 + ⌊random × 3⌋ distinct random units with available ≥ 1, chosen by partial Fisher–Yates with `random`;
    - each update is guarded with `on_hand - reserved >= 1`.
  - **restock:**
    - up to 3 random units with available ≤ 5;
    - target = max(seeded level, 10), where the seeded level is `seedOnHand(productId)` or `seedSizeOnHand(productId, sort_order)`;
    - sets `on_hand = reserved + target`.
  - Every change is logged with its source. The tick returns the changes.
- **Settings:** `getSettings()` and `saveSettings()` on `app_settings`. The defaults are off, off and 60.

### Scheduler (`sim/scheduler.ts`)

- A `setTimeout` loop, with `start()`, `reschedule()`, `stop()` and `nextTickAt()`.
- Each run reads the settings and ticks with whatever is on, then schedules the next run after the interval.
- `reschedule()` is called after saving settings, so a new interval takes effect at once.
- When both switches are off there's no timer, and `nextTickAt` is null.
- `createApp` creates and starts it only when `options.simScheduler` is true, which `server.ts` sets. Tests drive ticks through `POST /api/sim/automation/run`.

### Routes (`sim/routes.ts`, behind `requireOperator`)

| Endpoint | Behaviour |
|---|---|
| `GET /sim/inventory` | `list` |
| `PUT /sim/inventory/units` | zod body; `setOnHand` |
| `GET /sim/automation` | settings + `nextTickAt` + last 20 log entries |
| `PUT /sim/automation` | strict body; `saveSettings` + `reschedule` |
| `POST /sim/automation/run` | `tick` with the current switches (spec FR-6); `409 AUTOMATION_OFF` when both are off. The web disables the button then, with "Turn on decrease or restock first" |

The JSON-only POST guard applies to `PUT` bodies through `express.json`. A `PUT` without JSON fails validation.

## 4. Web

- **Console:** `features/sim/SimConsole.tsx` is the layout for `/sim/*`: the operator banner, sign-in (moved out of `SimOrdersPage`), Sign out, and tab links Orders and Inventory. `/sim` redirects to `/sim/orders`.
- **`SimInventoryPage.tsx`:**
  - search (debounced) and filter;
  - product rows, with expandable size rows;
  - `StockStepper` (−, value input, +), which saves on blur or Enter and shows the below-held message;
  - Show more.
- **`SimulationPanel.tsx`:**
  - two switches and an interval select;
  - Run once now;
  - the next tick, with a relative time;
  - `ChangeLog` (a list).
  - It polls every 5 seconds while a switch is on.
