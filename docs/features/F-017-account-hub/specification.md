# Feature Specification

## Feature

**ID:** F-017
**Name:** Account overview hub
**Status:** Proposed

---

## 1. Objective

Replace the plain "My account" page with an overview hub that matches the rest of the app. It shows the shopper's recent activity at a glance and gives one place to reach orders, addresses and the wishlist.

## 2. User Problem

The account page is a narrow list of name, email and mobile plus three outline buttons. It shows nothing about orders or saved items and looks unfinished next to the product, cart and order pages.

## 3. User Intent

"Show me where things stand (my latest order, my saved stuff) and take me where I need to go."

## 4. User Stories

- As a signed-in shopper, I see my latest order's status and can open it in one tap.
- As a signed-in shopper, I see my default address, my wishlist count and what I viewed recently.
- On desktop, I move between account sections from a sidebar.

## 5. Functional Requirements

**FR-1 Profile header.** It shows:
- the initials avatar (from the name), then the name and email;
- the mobile, if present;
- "Member since Oct 2026" (needs `memberSince` on `/auth/me`);
- a Sign out button.

**FR-2 Latest order tile.**
- Shows the most recent paid order with its thumbnails (up to 3), status badge, date, item count and amount. The whole tile links to the order.
- "View all orders" goes to `/account/orders`.
- If any order is Out for delivery, its delivery code is shown here, as on the orders list.
- **Empty:** "No orders yet" with **Start shopping** linking to `/products`.

**FR-3 Default address tile.**
- Shows the default address (name, line 1, city, pincode).
- **Manage** goes to `/account/addresses`.
- **Empty:** "No saved address" with **Add address**.

**FR-4 Wishlist tile.**
- Shows the count and up to 4 thumbnails, linking to `/wishlist`.
- **Empty:** "Save items you like with ♡".

**FR-5 Recently viewed.**
- The existing recently-viewed rail, up to 8 products.
- Hidden when empty.

**FR-6 Account navigation.**
- **Desktop (≥ lg):** a left sidebar with Overview, Orders, Addresses, Wishlist and Sign out. It is shown on `/account`, `/account/orders` and `/account/addresses*`, and the current section is highlighted (`aria-current`).
- **Mobile:** the overview's tiles are the navigation. Section pages keep their current back links.

**FR-7** The header account dropdown gains a Wishlist entry. Its other entries are unchanged.

## 6. Non-Functional Requirements

- Tiles load independently: one failing doesn't blank the page.
- 360 px works, and the layout uses the app's `max-w-7xl` container.
- Landmarks: `nav` for the sidebar and headed sections.

## 7. UX Requirements

- No new actions beyond navigation and Sign out. "Rich surface, simple decisions".
- Each tile has one obvious link.

## 8. UI Requirements

- `AccountLayout` (sidebar + outlet) wraps `/account`, `/account/orders` and `/account/addresses*`.
- `AccountOverview` with the four sections. Tiles use the existing card style (`rounded-xl border`).
- Skeletons per tile while loading.

## 9. Data Requirements

No new tables. It reuses orders, addresses, wishlist and recently viewed.

## 10. API Requirements

- `GET /auth/me`: `user.memberSince` (ISO date from `users.created_at`).
- The latest order uses the existing `GET /orders` first page.

## 11. State Management

It uses the existing React Query hooks (`useMe`, `useOrders`, `useAddresses`, `useWishlist`) and the local recently-viewed list.

## 12. Loading States

The header, then a skeleton for each tile.

## 13. Empty States

Per tile, as listed in FR-2 to FR-5.

## 14. Error States

- A failed tile shows "Couldn't load your orders" with Retry. The other tiles are unaffected.
- Signed out redirects to sign-in with a return path (as today).
- Offline shows the existing offline banner.

## 15. Security Considerations

- Owner-only data, already protected.
- The delivery code is shown only to the owner (existing rule).

## 16. Analytics

N/A. Navigation only.

## 17. Acceptance Criteria

1. A shopper with orders sees the latest order with its status, date, amount and thumbnails, and the tile opens it.
2. A shopper with no orders, addresses or wishlist items sees the three empty tiles with their links, and no recently-viewed section.
3. The default address and wishlist count match the Addresses and Wishlist pages.
4. "Member since" shows the account's creation month.
5. On desktop, the sidebar appears on the overview, orders and addresses pages with the current item marked. On a 360 px phone there's no sidebar and nothing overflows.
6. If the orders request fails, only that tile shows an error with Retry.
7. Sign out works from the header and from the sidebar.

## 18. Testing Strategy

- **Component:** the overview with data, empty and tile-error states; sidebar `aria-current`.
- **API:** `memberSince` on `/auth/me`.
- **E2E:** open the account page after placing an order and follow the latest-order tile.

## 19. Dependencies

F-005 wishlist, F-006 auth, F-007 addresses, F-010 orders, F-003 recently viewed.

## 20. Out of Scope

- Editing name or password, changing mobile or email.
- Deleting the account.
- Notification preferences.
- Saved cards.
- Rewards.

## 21. Assumptions

"Latest order" means the newest paid order, not pending-payment attempts, matching the orders list.

## 22. Decisions Required From User

None. Scope chosen 2026-10-07: overview hub only.
