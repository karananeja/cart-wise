# Feature Intent

**Feature:** F-004 — Guest cart (with Add to cart on the product page)
**Status:** Awaiting Approval
**Approved by / date:** —

---

## 1. In one sentence

Anyone can put products, in the right size, into a cart that remembers them, respects real stock, and shows clearly what everything costs, without signing up.

## 2. Intended behavior

- **Product page:**
  - An **Add to cart** button.
  - On clothing and shoes with no size picked, it asks "Please select a size" instead of adding.
  - When sold out it reads **Out of stock**.
  - After adding: the header cart count goes up, an "Added to cart · View cart" note appears, and the button becomes **Go to cart**.
- **Cart page:**
  - Each item has image, title, size, price, a − / + quantity control, its total, and Remove.
  - Removing shows **Undo** for a few seconds.
  - A summary shows Total MRP, Discount, **Subtotal**, and "Delivery: calculated at checkout".
- **Quantity limits:** up to 10 per item, never more than what's actually in stock, with the reason shown.
- **Persistence:** the cart is kept on our server for this browser, so it survives reloads and return visits for 30 days. It is ready to move into an account when sign-in arrives.
- **Stock changes:** if stock drops after you added something, the item is flagged ("Only 2 available" or "Out of stock") and excluded from the subtotal, never silently removed.
- **No checkout button yet:** Proceed to checkout comes with the checkout features, so nothing on the page is non-working.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| Button becomes **Go to cart** after adding | One obvious next step; prevents accidental duplicates. Quantity is changed in the cart |
| Size prompt instead of a disabled button | Tells the user *why*, and takes them to the fix |
| Undo instead of "Are you sure?" | Fewer dialogs, same safety |
| Max 10 per item | Sensible consumer limit; avoids silly quantities |
| Cart stored server-side with an anonymous cookie (30 days) | The brief puts carts in application-owned state; makes the account merge in F-006 straightforward |
| Prices always live, never stored in the cart | Never shows a stale price |
| Problems flagged, not auto-fixed | The user stays in control of their cart |

## 4. What this feature deliberately does not do

Checkout, stock reservation, delivery/tax calculation, coupons, wishlist moves, accounts and merging, add-to-cart from listing cards, price-change alerts, save for later, mini-cart drawer.

## 5. How we will know it works

Acceptance criteria 1–13 in `specification.md` §17.

## 6. Decisions needed before implementation

Confirm or adjust: max 10 per item; guest carts kept for 30 days; "Go to cart" after adding.

## 7. Approval

- [ ] Approved for implementation (Gate 1)
