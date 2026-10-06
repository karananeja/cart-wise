# Feature Intent

**Feature:** F-005 — Wishlist
**Status:** Awaiting Approval
**Approved by / date:** —

---

## 1. In one sentence

Anyone can tap a heart to save a product for later, see everything they saved with current prices, and move it to the cart (choosing a size if needed) when they're ready, without signing up.

## 2. Intended behavior

- **Saving:**
  - A heart on every product card (top-right of the image) and on the product page.
  - Tap to save (the heart fills), tap again to remove.
  - The header gets a heart icon with a count, next to the cart.
- **Wishlist page:**
  - Saved products, newest first, with current price and real availability.
  - Each has **Move to cart** (or **Out of stock**) and remove.
- **Move to cart:**
  - Unsized products go straight into the cart.
  - Clothes and shoes ask for a size first, in a small picker.
  - On success the item leaves the wishlist and you get "Moved to cart · View cart".
  - If it can't be added (sold out, limit reached), it stays saved and the reason is shown.
- **Move to wishlist from the cart:** each cart line can be moved to the wishlist, with Undo.
- **Storage:** kept on the server for this browser via an anonymous cookie (same pattern as the cart) for 90 days. Ready to merge into an account at sign-in.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| Save products, not sizes | Users often save before deciding on size; size is asked only when buying |
| Hearts on every card | Saving should be possible wherever a product appears |
| Toggle instead of confirmation | One tap to save, one tap to undo |
| Out-of-stock items can be saved | Often why people save; back-in-stock alerts come later (Phase 2) |
| Move to cart removes from wishlist | Matches the word "move"; avoids duplicates between lists |
| 100 items, 90 days | Bounded, but generous for "later" |

## 4. What this feature deliberately does not do

Price-drop or back-in-stock alerts, multiple or shared lists, saving a size, notes, wishlist-based recommendations, account sync.

## 5. How we will know it works

Acceptance criteria 1–13 in `specification.md` §17.

## 6. Decisions needed before implementation

Confirm or adjust: product-level saving, 100-item cap, 90-day guest lifetime, hearts on every product card.

## 7. Approval

- [ ] Approved for implementation (Gate 1)
