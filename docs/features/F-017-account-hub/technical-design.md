# Technical Design — F-017 Account overview hub

- **API:** `SessionUser` carries `createdAt` (sessions and auth queries select `users.created_at`). `PublicUser.memberSince` is returned on `/auth/me` and on sign-in responses.
- **Routing:** `/account` is a layout route (`features/account/AccountLayout.tsx`) with the overview as its index and orders and addresses as children. The paths are unchanged.
  - The sidebar (`nav[aria-label=Account]`, `NavLink` gives `aria-current`) shows only at `lg` and only when signed in.
  - Each page keeps its own sign-in redirect.
- **Overview:** `features/account/AccountPage.tsx` replaces `features/auth/AccountPage.tsx`.
  - Profile card (initials, mobile when present, member since, Sign out).
  - `LatestOrderTile` uses the first item of `useOrders()` and the shared `OrderCard` from OrdersPage, now exported with a `headingLevel` prop.
  - `AddressTile` takes the default address, or the first one.
  - `WishlistTile` shows the count and 4 thumbnails.
  - The existing `RecentlyViewedRail` hides itself when empty.
  - Each tile has its own loading, empty and error-with-Retry states.
- **Header menu:** a Wishlist entry is added.
