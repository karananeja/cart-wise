# Feature Intent

**Feature:** F-013 — Electronics variants
**Status:** Awaiting Approval
**Approved by / date:** —

---

## 1. In one sentence

Phones and tablets come in storage options and laptops in RAM + storage configurations. Each option has its own price and stock, and the chosen option carries through cart, checkout, payment and orders.

## 2. Intended behavior

- **Product page:**
  - A row of options, each showing its price (e.g. "128 GB · ₹29,732", "256 GB · ₹32,705").
  - The cheapest in-stock option is preselected.
  - Picking another updates the price, discount, card offer and stock line. Sold-out options stay visible, struck through.
- **Listings, search, wishlist and rails:**
  - The price reads "From ₹X".
  - Filters and sorting use that starting price.
- **Cart, checkout, payment, orders:**
  - Each line names its configuration ("256 GB" or "16 GB · 512 GB") and is priced at it.
  - Two options of the same phone are two lines.
  - Holds, refunds and the Simulation Console all work per option.
- **Unchanged:** accessories, watches and apparel sizes. Existing carts land on the base option at the price they already showed.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| Prices on the option buttons | Compare without clicking each option |
| One combined RAM + storage choice for laptops | No invalid combinations, one decision |
| Cheapest in-stock option preselected (D2) | A concrete price and one-tap add; any option is valid, unlike a size |
| "From ₹X" on cards (D3) | Honest when higher options cost more |
| Today's price becomes the base option | Nothing gets cheaper or jumps unexpectedly |

## 4. What this feature deliberately does not do

- Colour options.
- Options for accessories or watches.
- Per-option images or reviews.
- Option comparison tables.

## 5. How we will know it works

Acceptance criteria 1–11 in `specification.md` §17.

## 6. Decisions needed before implementation

- D1 tiers and price steps
- D2 preselection
- D3 card price

See specification §22.

## 7. Approval

- [ ] Approved for implementation (Gate 1)
