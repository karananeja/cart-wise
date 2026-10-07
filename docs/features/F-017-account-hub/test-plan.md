# Test Plan — F-017 Account overview hub

| Level | File | Covers |
|---|---|---|
| API | `apps/api/src/auth/auth.test.ts` | `memberSince` on user responses |
| Component | `apps/web/src/features/account/Account.test.tsx` | Guest redirect; profile (initials, masked mobile, member since; no mobile); empty tiles with their links and no recently viewed; latest order (newest, status, delivery code, links), default address, wishlist count and thumbnails; orders failure isolated with Retry; sidebar `aria-current` on overview and orders |
| E2E | `e2e/orders.spec.ts` "account overview" | After paying, the overview shows the order and address; the tile opens the order |
| Manual | Screenshots 1280 px / 360 px | Layout, no horizontal scroll |
