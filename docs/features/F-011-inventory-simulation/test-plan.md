# Test Plan

**Feature:** F-011 — Store Simulation Console: inventory simulation

## 1. Scope

**Tested:**
- inventory list, search and filters;
- manual stock changes and the below-held guard;
- automation ticks (decrease, restock), settings persistence and Run once now;
- the change log;
- operator-only access;
- storefront reaction.

**Not tested:** real wall-clock scheduling over minutes. The scheduler loop is unit-tested with fake timers.

## 2. Risk areas

- **Held stock:** automation or manual edits taking held units, or making stock negative.
- **Restock target:** wrong seeded level for sized items.
- **Settings:** lost on restart, or automation running when switched off.
- **Silent draining** of stock.

## 3. Tests

| Level | Area | Cases | File |
|---|---|---|---|
| API | List | Search, Low and Sold-out filters (product totals), sized units, paging | `apps/api/src/sim/inventory.test.ts` |
| API | Manual | Set, + and −, bounds 0–999, below held → 409 with `held`, unknown unit 404, log entry, storefront availability changes | same |
| API | Ticks | Decrease: 1–3 units, only available ones, held untouched, never negative, nothing available → no change; restock: ≤5 available only, target = max(seed, 10) for sized and unsized, up to 3 | same |
| API | Settings | Defaults off/off/60; save; persisted across a new app on the same database; bad interval refused; run once applies only what is on, and is refused when both are off | same |
| API | Access | Every inventory route 401 without the operator session | same |
| Unit | Scheduler | No timer when off; ticks at the interval; reschedule on change; `nextTickAt` | `apps/api/src/sim/scheduler.test.ts` |
| Component | Inventory tab | Search, filter, stepper save, below-held message, size rows | `features/sim/SimInventory.test.tsx` |
| Component | Panel | Switches, interval, run once, log | same |
| E2E | Journey | Operator sets a product to 0 → the storefront shows Sold out and the cart flags it; restock (Run once now) → back in stock; tabs; mobile | `e2e/simulation.spec.ts` |

## 4. Manual verification

- Run automation at 10 s for a minute and watch the log and the storefront.

## 5. Results

| Run date | Command | Result | Notes |
|---|---|---|---|
| 2026-10-06 | `pnpm test` | 401 passed (shared 38, api 215, web 148) | |
| 2026-10-06 | `pnpm e2e` ×11 | 46 passed in each of the last 11 runs | One earlier run failed an F-009 payment test once (not reproduced; see acceptance §3). Simulation spec runs as its own project after the others |
| 2026-10-06 | `pnpm typecheck`, `pnpm build` | Clean | |
