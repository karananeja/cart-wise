# ADR-003: Authentication and Sessions

**Status:** Proposed (with F-006, 2026-10-06)
**Date:** 2026-10-06

## Decision

Use server-side sessions held in an HTTP-only cookie. Hash passwords with Node's built-in scrypt. Sign-in, sign-up and reset use simulated one-time codes that are stored hashed and returned to the client only as a demo field.

## Context

- Brief §4: lightweight sign-up (name, email, mobile, password), with guest state merged on sign-in.
- User decisions (2026-10-06): simulated mobile OTP verification; mobile + OTP sign-in; reset by code; cart merge takes the larger quantity.
- Architecture: Express API with SQLite (ADR-001). Guest carts and wishlists already use anonymous HTTP-only cookies (F-004, F-005).
- MVP scope: no paid services, no real SMS, no production secrets management.

## Options Considered

1. **Server-side sessions** (random token in an HTTP-only cookie, hash stored in SQLite):
   - easy to revoke (sign-out, password reset);
   - matches the existing cookie pattern;
   - one database lookup per request, which is negligible here.
2. **Signed JWT in a cookie:**
   - stateless, but revocation needs a deny-list anyway;
   - adds a signing-secret management concern;
   - no benefit for a single API.
3. **Third-party auth provider:** an external service, cost and network dependency; against NFR-1.

**Password hashing:** Node `crypto.scrypt` (no dependency, memory-hard) versus bcrypt or argon2 (native modules). scrypt is chosen.

## Decision

- **Sessions:** a 32-byte random token in a cookie (`session`, `HttpOnly`, `SameSite=Lax`, `Path=/`), with its SHA-256 hash stored. They last 30 days, are extended by use, and are deleted on sign-out. A password reset revokes all of the user's sessions.
- **Passwords:** scrypt with a 16-byte salt, stored as `scrypt$N$r$p$salt$hash` and compared in constant time. Policy: at least 8 characters plus a small common-password blocklist, with no composition rules (in line with NIST 800-63B).
- **Codes:** 6 digits from `crypto.randomInt`, stored as an HMAC-style hash. They last 5 minutes, allow 5 attempts, can be resent after 30 seconds, and are capped at 5 per mobile per hour. Delivery is simulated: the code is returned as `demoCode` and shown in a labelled demo banner. A production build would remove that field and send an SMS instead.
- **Cross-site request forgery:** `SameSite=Lax`, plus a rule that state-changing `/api` requests must have `Content-Type: application/json`. Cross-site forms cannot send JSON without a CORS preflight, which is never allowed. The analytics beacon endpoint is exempt.
- **Rate limits:** in-memory counters (5 failed password sign-ins per identifier per 15 minutes). This is acceptable for a single-process MVP.
- **Account identity of carts and wishlists:** `user_id` columns on the existing tables, unique when set. Guest rows keep their cookie ids, and merging happens at sign-in.
- **Account existence:** the OTP sign-in route reveals whether a mobile number has an account ("No account — sign up?"). Password sign-in uses a generic error. This trades a small enumeration risk for clearer shop UX; acceptable for this project.

## Reason

It is the simplest model that is secure enough, revocable, and consistent with the existing anonymous-cookie design, with no new dependencies.

## Consequences

- **In-memory limits:** rate limits reset when the API restarts (acceptable for local MVP; production would use a shared store).
- **Demo code field:** `demoCode` must never ship to production; it is isolated in one place (`auth/otp.ts`).
- **Plain HTTP locally:** cookies are not `Secure` in local development; production hardening is separate (CLAUDE.md §20).
