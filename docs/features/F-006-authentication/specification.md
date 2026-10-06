# Feature Specification

## Feature

**ID:** F-006
**Name:** Sign-up, sign-in and guest state merge
**Status:** Proposed (awaiting Gate 1)
**Requirements:** AUTH-1..4, STATE-2
**User decisions applied (2026-10-06):**
- verification by simulated mobile OTP;
- sign-in by mobile + OTP (passwordless), with a password set at sign-up;
- cart merge takes the larger quantity;
- "Forgot password" included, using a simulated code.

---

## 1. Objective

Let shoppers create an account and sign in with minimal friction, without losing anything they did as a guest. Their cart, wishlist, recently viewed products and recent searches come with them. This prepares checkout (F-008), which is where signing in becomes necessary.

## 2. User Problem

Shoppers need an account to buy and to keep their things across devices, but they resent long forms, password hassles, and losing the cart they just built.

## 3. User Intent

"Let me sign in quickly, and keep everything I already picked."

## 4. User Stories

- As a guest, I want to sign up with my name, email, mobile and a password, and confirm my mobile with a code.
- As a customer, I want to sign in with my mobile and a one-time code, without remembering a password.
- As a customer who prefers passwords, I want to sign in with my email or mobile and password.
- As a customer who forgot my password, I want to reset it with a code.
- As a guest who signs in, I want my cart, wishlist, recently viewed and recent searches to carry over.
- As a shopper who signs in from a product page, I want to land back where I was.

## 5. Functional Requirements

### 5.1 Simulated one-time codes (shared by sign-up, sign-in and reset)

- FR-1 Codes are **6 digits**, valid for **5 minutes**, single use, and stored only as a hash.
- FR-2 No real SMS is sent. The code appears on screen in a clearly marked demo banner: "Demo SMS to ••••••3210: your code is 482913". The API returns it in a `demoCode` field, which exists only because delivery is simulated.
- FR-3 **Limits:**
  - 5 wrong attempts per code (then a new code is needed);
  - "Resend code" is available after 30 seconds;
  - at most 5 codes per mobile number per hour.
- FR-4 The code input supports paste and the browser's one-time-code autofill (`autocomplete="one-time-code"`). Entering the 6th digit submits automatically.

### 5.2 Sign-up (`/signup`) — AUTH-1

- FR-5 **Fields:**
  - **Name:** 2–60 characters.
  - **Email:** normalised to lower case.
  - **Indian mobile number:** 10 digits starting 6–9; "+91" and spaces are accepted and normalised.
  - **Password:** at least 8 characters, with a show/hide toggle. Very common passwords are rejected ("That password is too common").
  - No address is asked for.
- FR-6 **Errors:**
  - fields are validated inline;
  - an email or mobile already registered shows "An account with this email/mobile already exists — Sign in instead";
  - a sign-up that was started but never verified does not block a new attempt.
- FR-7 After submitting, the shopper enters the OTP sent to their mobile. Verifying creates the account, marks the mobile as verified, signs them in and merges guest state (§5.6).

### 5.3 Sign-in (`/login`) — AUTH-2

- FR-8 **Default: mobile + OTP.**
  - The shopper enters their mobile, presses Send code, enters the code, and is signed in.
  - An unknown number gets "No account for this number. Sign up?" (with a link that keeps the number). For a shop, a clear answer beats hiding whether an account exists; the trade-off is noted in ADR-003.
- FR-9 **Alternative: "Use password instead".**
  - Email or mobile, plus password.
  - A wrong combination gets one generic message: "Incorrect email/mobile or password".
  - 5 failed attempts per identifier in 15 minutes trigger a temporary lockout with a clear message.
- FR-10 **Sign out** ends the session on this device.

### 5.4 Forgot password (`/forgot-password`)

- FR-11 The shopper enters their email or mobile. A code is "sent" to the account's mobile and shown in the demo banner. Entering it lets them set a new password, which signs them in and ends all their other sessions. An unknown identifier gets "No account found".

### 5.5 Sessions

- FR-12 Signing in creates a session that lasts 30 days and is extended by use. It is held in an HTTP-only cookie. Signing out or resetting the password ends it.
- FR-13 **Header:**
  - guests see **Sign in**;
  - signed-in shoppers see an account menu ("Hi, Karan") with **My account** and **Sign out**.
- FR-14 **My account (`/account`):** shows name, email and mobile (masked), plus Sign out. Editing the profile, addresses (F-007) and orders (F-010) come later.

### 5.6 Guest state merge — AUTH-3

- FR-15 Merging happens on every successful sign-in or sign-up, before the shopper is redirected.
- FR-16 **Cart:**
  - Each account has one cart; the guest cart's lines merge into it.
  - The same product and size in both → **the larger quantity** (Q12, user decision), capped by stock and the limit of 10.
  - Other lines are moved across.
  - The guest cart is then deleted.
  - Lines with stock problems are flagged as in F-004, never dropped.
- FR-17 **Wishlist:** the union of both, newest first, capped at 100 (the oldest are dropped if over).
- FR-18 **Recently viewed and recent searches:**
  - While signed in, these are also stored on the account, so they follow the shopper across devices.
  - At sign-in, this device's lists merge with the account's: de-duplicated, newest first, within the existing caps (20 and 10).
  - Signing out clears them from this device; they stay on the account.
- FR-19 **After sign-out:** the browser starts as a fresh guest, with an empty cart and wishlist. The account's items remain saved for the next sign-in.

### 5.7 Preserving intent — AUTH-4, STATE-2

- FR-20 Every route to sign-in carries `returnTo` (the current page, including size and other query parameters). After success the shopper lands back there. Only same-site paths are accepted.
- FR-21 Sign-in, sign-up and reset link to each other, keeping `returnTo` and any entered mobile or email.
- FR-22 Signing in is never forced in F-006. Checkout (F-008) will be the first place that requires it.

## 6. Non-Functional Requirements

- **Security** (see ADR-003):
  - passwords hashed with scrypt and a per-user salt;
  - session tokens are random (256-bit) and stored hashed;
  - comparisons use constant time;
  - cookies are HTTP-only and `SameSite=Lax`;
  - state-changing API requests must be JSON, a simple cross-site request forgery guard;
  - generic password-login errors and rate limits;
  - codes are hashed and expire.
- **Privacy:**
  - the mobile is masked in the UI (••••••3210);
  - passwords and codes are never logged;
  - analytics events carry no personal data.
- **Accessibility:**
  - labelled fields with inline errors linked through `aria-describedby`;
  - the code field is announced;
  - focus moves to the first error;
  - the password toggle is a button with a label.
- **Responsiveness:** single-column forms (max 28 rem), comfortable on 360 px screens.

## 7. UX Requirements

- One primary action per step (Send code → Verify → done).
- Sign-up asks only for what the brief lists. The OTP step adds verification without a second form.
- Passwordless is the default sign-in; the password route is one link away.
- No dead ends: wrong code (attempts left shown), expired code (Resend), forgot password, unknown account (Sign up).
- After signing in, a short confirmation is shown: "Welcome back, Karan. We kept your cart." (shown only when something was merged).

## 8. UI Requirements

- **Screens:** `/signup`, `/login` (OTP and password modes), `/forgot-password`, `/account`.
- **Components:** OtpInput, DemoSmsBanner, PasswordField, HeaderAccount (Sign in / menu), AuthLayout.
- **States:** submitting, field errors, wrong code, expired code, locked out, rate-limited resend, success redirect, offline.

## 9. Data Requirements

| Entity | Key fields | Notes |
|---|---|---|
| User | id, name, email (unique), mobile (unique), passwordHash, mobileVerifiedAt, createdAt | Unverified sign-ups don't block a new attempt |
| Session | tokenHash, userId, createdAt, expiresAt, lastSeenAt | 30-day rolling |
| OtpChallenge | id, purpose (signup/login/reset), mobile, codeHash, expiresAt, attempts, consumedAt, pending sign-up details | |
| Cart / Wishlist | gain `user_id` (unique when set) | Guest lists keep cookie ids |
| Account recently viewed / searches | userId, slug or query, timestamp | Caps 20 / 10 |

## 10. API Requirements

All under `/api/auth`, JSON only.

| Endpoint | Purpose |
|---|---|
| `POST /signup` | Validate details, create a sign-up challenge → `{ challengeId, maskedMobile, demoCode, resendAfter }` |
| `POST /otp` | `{ mobile, purpose: 'login' \| 'reset' }` or `{ identifier, purpose: 'reset' }` → challenge |
| `POST /otp/resend` | `{ challengeId }` |
| `POST /verify` | `{ challengeId, code }` → for sign-up and sign-in: signs in and merges; for reset: returns a short-lived reset token |
| `POST /password` | `{ identifier, password }` sign-in |
| `POST /reset` | `{ resetToken, newPassword }` → sets the password, revokes other sessions, signs in |
| `POST /logout` | Ends the session |
| `GET /me` | `{ user: { name, email, maskedMobile } \| null }` |
| `POST /sync` | `{ recentlyViewed, recentSearches }` → merged lists (also called after sign-in) |

**Errors:**
- `400 VALIDATION` (with field errors);
- `409 EMAIL_TAKEN` / `MOBILE_TAKEN`;
- `404 NO_ACCOUNT`;
- `401 INVALID_CREDENTIALS` / `INVALID_CODE` (attempts left);
- `410 CODE_EXPIRED`;
- `429 TOO_MANY_ATTEMPTS` / `TOO_MANY_CODES` (retry-after).

## 11. State Management

- Server state: a `me` query, shared by the header and pages. After sign-in or sign-out the client refetches me, cart and wishlist.
- Local: form state, the challenge id and the resend countdown.
- The recently-viewed and search-history stores gain a "signed-in" mode that also posts additions to the account (fire and forget).

## 12. Loading States

Buttons show progress and stay the same size. The header shows a neutral placeholder until `me` loads, so it never flashes "Sign in" for a signed-in user.

## 13. Empty States

N/A (forms).

## 14. Error States

- §10 errors map to friendly messages next to the relevant field.
- Network or server failure: "We couldn't reach the store. Please try again."
- Offline: forms disabled with a notice.

## 15. Security Considerations

See §6 and ADR-003. Additionally:
- `returnTo` is restricted to relative paths (no open redirects);
- a session is created only after a successful verification;
- reset tokens are single-use and last 10 minutes;
- account existence is revealed only on the code-sign-in path (a deliberate UX choice for a shop, noted in ADR-003).

## 16. Analytics

N/A. The brief's event set does not include authentication events, and none are added (CLAUDE.md §15).

## 17. Acceptance Criteria

1. Sign-up with valid details shows the demo SMS banner. Entering the code creates the account, signs in, and returns to `returnTo`.
2. Invalid fields, a common password, and an existing email or mobile show clear inline errors; nothing is created.
3. Mobile + OTP sign-in works for an existing account. An unknown number offers Sign up with the number kept.
4. A wrong code shows the attempts left; after 5 a new code is required. An expired code offers Resend. Resend is available only after 30 seconds.
5. Password sign-in works with either email or mobile. Wrong details give one generic message; 5 failures in 15 minutes lock that identifier temporarily.
6. Forgot password: identifier → code → new password signs in, and other sessions stop working.
7. The header shows Sign in for guests and "Hi, <name>" with My account and Sign out once signed in. Sign-in survives reload and lasts 30 days with use.
8. **Cart merge:**
   - guest cart A×2 and account cart A×1 → A×2;
   - guest-only and account-only lines are both present;
   - stock problems are flagged, not dropped.
9. Wishlist merge produces the union, capped at 100.
10. Recently viewed and recent searches from the guest session are merged with the account's and appear on another browser after signing in there. Sign-out clears them from this device.
11. After sign-out the browser has an empty guest cart and wishlist; signing back in restores the account's.
12. `returnTo` brings the shopper back to the exact page (including size); external URLs are ignored.
13. Passwords and codes are never stored in plain text or logged; session cookies are HTTP-only; non-JSON state-changing requests are rejected.
14. All forms work by keyboard, errors are announced, and there is no horizontal scroll at 360 px.

## 18. Testing Strategy

- **Unit:** validation and normalisation (mobile, email, password), hashing and verification, code generation and expiry, attempt and rate limits, merge rules (cart max, wishlist union and cap, history merges).
- **API:**
  - every endpoint and error code;
  - sessions (creation, expiry, sign-out, revocation on reset);
  - the merge on sign-in for each list;
  - the JSON-only guard;
  - `returnTo` sanitising (client).
- **Component:** sign-up, OTP entry (paste, autofill, auto-submit), password mode, forgot password, header states, the merge confirmation.
- **E2E:**
  - guest builds a cart and wishlist, then signs up from a product page and returns to it with everything kept;
  - sign out, then sign in with OTP;
  - sign in on a second browser and see the account's items;
  - mobile layout.

## 19. Dependencies

F-004 (cart) and F-005 (wishlist), both complete. ADR-003 (to be accepted with this spec). F-007 (addresses) and F-008 (checkout) build on accounts.

## 20. Out of Scope

- Social login
- Real SMS or email delivery
- Email verification
- Profile editing
- Account deletion
- Two-factor for password sign-in
- Device or session management lists
- CAPTCHA
- Production secrets and hardening (CLAUDE.md §20)

## 21. Assumptions

- **Sign-in interpretation:** "Mobile + OTP (passwordless)" is read as OTP being the default sign-in, with password sign-in available as an alternative (since a password is set at sign-up and "Forgot password" was chosen). Please confirm.
- **Phone numbers:** Indian mobile numbers only, matching the ₹ store.
- **Account existence:** revealing that a number has no account (OTP route only) is acceptable for this shop.

## 22. Decisions Required From User

Confirm when approving:
1. The sign-in interpretation in §21.
2. 6-digit codes, 5-minute validity, 5 attempts, 30-second resend, 5 codes per hour.
3. After sign-out the device returns to an empty guest state, and the account keeps its items.
