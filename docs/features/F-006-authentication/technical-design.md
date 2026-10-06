# Technical Design — F-006 Sign-up, sign-in and guest state merge

**Status:** Implementation
**Inputs:** specification.md (approved), ADR-003, F-004/F-005 designs

## 1. Data

New tables (created by `schema.sql`):

```sql
users(id PK, name, email UNIQUE, mobile UNIQUE, password_hash, mobile_verified_at, created_at)
sessions(token_hash PK, user_id FK CASCADE, created_at, expires_at, last_seen_at)
otp_challenges(id TEXT PK, purpose, mobile, user_id NULL, code_hash, payload NULL, attempts,
               created_at, expires_at, last_sent_at, consumed_at)
otp_sends(mobile, sent_at)                                  -- per-hour send limit
password_resets(token_hash PK, user_id FK CASCADE, expires_at, used_at)
user_recently_viewed(user_id, slug, viewed_at, PK(user_id, slug))
user_search_history(user_id, query_key, query, searched_at, PK(user_id, query_key))
```

- **Users are verified only.** Pending sign-up details (including the already-hashed password) live in the sign-up challenge's `payload` until the code is verified. This keeps `users` clean and means an unverified attempt never blocks a new one.
- **Existing tables:** `carts.user_id` and `wishlists.user_id` (nullable, unique when set) are added by an idempotent `ensureColumn` step after the schema runs, so existing developer databases upgrade in place without re-seeding. Fresh databases get the columns from `schema.sql`.

## 2. Modules (`apps/api/src/auth/`)

| Module | Responsibility |
|---|---|
| `validation.ts` | Normalise and validate name, email, Indian mobile, password (common-password blocklist); field errors |
| `passwords.ts` | scrypt hash/verify (`scrypt$N$r$p$salt$hash`), constant-time compare |
| `otp.ts` | Create/resend/verify challenges, limits, hashing. The only place `demoCode` is produced |
| `sessions.ts` | Create (random 32 bytes, store SHA-256), resolve with rolling expiry, destroy, destroy all for a user |
| `rateLimit.ts` | In-memory failed-password counter per identifier (5 per 15 minutes) |
| `merge.ts` | Guest → account merge for cart (larger quantity, capped), wishlist (union, cap 100), and the history sync |
| `routes.ts` | `/api/auth/*` endpoints |

**Request identity:**
- Middleware resolves the session cookie to `res.locals.user`.
- Cart and wishlist routes now use an `owner`: either `{ userId }` or `{ guestId }` from the cookie.
- A guest cookie resolves only rows with `user_id IS NULL`, so a signed-out device can't reach an account cart through an old cookie.
- Signing in clears the guest cookies; signing out clears the session, cart and wishlist cookies.

**Cross-site guard:** `POST` requests under `/api` must be `application/json` (except `/api/events`). `PUT`, `PATCH` and `DELETE` are non-simple methods, so browsers already require a CORS preflight for them, which is never granted.

## 3. Merge rules

- **Cart:**
  - If the account has no cart, it adopts the guest cart (sets `user_id`).
  - Otherwise each guest line either merges into a matching line, with quantity = min(max(a, b), 10, available if > 0), or moves across.
  - The guest cart is then deleted.
- **Wishlist:** adopt, or `INSERT OR IGNORE` the guest items, keep the newest 100, delete the guest wishlist.
- **History:** `POST /api/auth/sync` upserts the client's items, keeping the newer timestamp, trims to 20 and 10, and returns the merged lists.

## 4. Web (`apps/web/src/features/auth/`)

- **Data:** `useMe` (key `['me']`) and mutations. After any sign-in the client invalidates `me`, `cart` and `wishlist`, then navigates to `returnTo` with a welcome notice in history state.
- **Pages:** `LoginPage` (OTP, or password with `?method=password`), `SignupPage`, `ForgotPasswordPage`, `AccountPage` (guests are redirected to login with `returnTo`).
- **Components:** `OtpInput` (one numeric field, `autocomplete="one-time-code"`, auto-submits at 6 digits), `DemoSmsBanner`, `PasswordField`, `FormField`, `HeaderAccount`.
- **History sync:** `createLocalList` gains `setAll` and add-listeners. A `HistorySync` component in the layout:
  - runs a full sync when a user id appears;
  - posts each later addition while signed in.

  Sign-out clears both local lists.
- **`returnTo`:** accepted only if it starts with `/` and not `//` or `/\`.
