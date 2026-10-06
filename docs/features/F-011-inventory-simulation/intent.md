# Feature Intent

**Feature:** F-011 — Store Simulation Console: inventory simulation
**Status:** Draft — awaiting Gate 1
**Approved by / date:**

---

## 1. In one sentence

The demo operator can change real stock by hand or let it drift automatically, draining and refilling, so the store's honest stock states can be shown live.

## 2. Intended behavior

- **One console** (`/sim`) with **Orders** (as built in F-010) and **Inventory** tabs, behind the same operator password.
- **Inventory tab:**
  - search by name; filter All, Low stock or Sold out;
  - each product (and each size) shows On hand, Held in checkout, Available and status;
  - **−** and **+** buttons, or type an exact number. On hand can't drop below what's held in someone's checkout.
- **Simulation panel:**
  - **Automatic decrease** (1–3 random available units lose 1 per tick) and **Automatic restock** (up to 3 low or sold-out items refilled to their usual level, at least 10);
  - interval 10 s, 30 s, 60 s or 5 min; both off by default; settings remembered across restarts;
  - **Run once now**;
  - the next tick time.
- **Change log:** the last 20 changes (manual or automatic), with before → after.
- **Storefront:** reacts with its existing honest states (Only N left, Sold out, cart lines flagged). Nothing like "selling fast" is ever shown.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| Never below held units | Customers in checkout keep what they were promised |
| Automation off by default, with a visible status | No silent stock drain |
| Run once now | Demonstrate a tick without waiting |
| Change log | The operator can see what the simulation just did |
| No urgency messaging | Real inventory only; no manipulation (CLAUDE.md §13) |

## 4. What this feature deliberately does not do

- Price changes
- Adding products
- Back-in-stock alerts
- Charts
- Suppliers
- Automatic order progression

## 5. How we will know it works

Acceptance criteria 1–10 in `specification.md` §17.

## 6. Decisions needed before implementation

None. Confirmed 2026-10-06.

## 7. Approval

- [ ] Approved for implementation (Gate 1)
