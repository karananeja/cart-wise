# Test Plan

**Feature:** F-006 — Sign-up, sign-in and guest state merge

## 1. Scope

Validation, password hashing, codes and limits, sessions, sign-up and sign-in (code and password), reset, guest merges (cart, wishlist, history), owner isolation, the cross-site guard, and the UI flows end to end.

## 2. Risk areas

- Security: hashing, token storage, enumeration, lockout, old-cookie access to account carts
- Merge correctness (larger quantity, union cap)
- `returnTo` open redirects
- Timing races between verification and navigation

## 3. Tests

| Level | Area | File |
|---|---|---|
| API | sign-up, codes (attempts, expiry, resend, hourly cap, reuse), OTP and password sign-in, lockout, sign-out, session expiry, reset revokes sessions, merges, history sync, old guest cookie, cross-site guard | `apps/api/src/auth/auth.test.ts` |
| Component | sign-up from a product page and back; inline errors; existing account; OTP with wrong code; unknown number → sign-up; password sign-in; visibility toggle; unsafe `returnTo`; merge notice; reset; sign-out; history sync; account page | `apps/web/src/features/auth/Auth.test.tsx` |
| E2E | guest → sign-up from product page keeps cart and wishlist → sign-out → OTP sign-in restores; second browser sees cart and recently viewed; larger-quantity merge; reset signs out other devices; mobile header | `e2e/auth.spec.ts` |

## 4. Manual verification

Screenshots on preview ports (5274/3201): sign-up errors, code step, signed-in product page with notice, account menu, mobile sign-in.

## 5. Results

| Run date | Command | Result | Notes |
|---|---|---|---|
| 2026-10-06 | `pnpm test` | 244 passed (shared 16, api 136, web 92) | Auth component tests stable over 3 runs |
| 2026-10-06 | `e2e/auth.spec.ts --repeat-each=15 --workers=3` | 75 passed | Stress run after fixing two test races |
| 2026-10-06 | `pnpm e2e --repeat-each=3 --workers=2` | 87 passed (29 × 3) | |
| 2026-10-06 | `pnpm typecheck`, `pnpm build` | Clean / succeeds | |

### Defects found and fixed during testing

- **Cart/wishlist first write after the owner refactor** returned an empty view, because it read by the request's (not yet existing) cookie instead of the newly created id. Caught by the existing cart and wishlist API tests.
- **Duplicate React keys** in the code step (banner and input both keyed by the code). Found by console checks during screenshots.
- **Test-only:** a "Password" label matcher also matched "Show password"; E2E navigated before verification or a quantity update had finished (fixed by waiting for the visible outcome).
