# Feature Intent

**Feature:** F-017 — Account overview hub
**Status:** Awaiting Approval
**Approved by / date:** —

---

## 1. In one sentence

"My account" becomes an overview hub: who you are, your latest order, default address, wishlist and recently viewed, with a sidebar on desktop.

## 2. Intended behavior

- **Header:** initials avatar, name, email, mobile (if any), "Member since Oct 2026", Sign out.
- **Latest order tile:** thumbnails, status badge, date, amount; opens the order. Shows the delivery code when the order is out for delivery. "View all orders".
- **Default address tile:** Manage.
- **Wishlist tile:** count and thumbnails.
- **Recently viewed:** a rail, hidden when empty.
- **Empty tiles** each have one link: Start shopping, Add address, or a hint to use ♡.
- **Desktop:** a sidebar (Overview, Orders, Addresses, Wishlist, Sign out) on the overview, orders and addresses pages.
- **Header account menu:** gains Wishlist.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| Tiles load and fail independently | One slow or failed request doesn't blank the page |
| Navigation only, no editing | Your scope choice; keeps decisions simple |
| Sidebar desktop-only | On phones the tiles already are the navigation |

## 4. What this feature deliberately does not do

- Editing name, password, email or mobile.
- Account deletion.
- Saved cards.
- Notification settings.

## 5. How we will know it works

Acceptance criteria in `specification.md` §17.

## 6. Decisions needed before implementation

None (scope chosen 2026-10-07).

## 7. Approval

- [ ] Approved for implementation (Gate 1)
