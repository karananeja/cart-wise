# Acceptance

**Feature:** F-006 — Sign-up, sign-in and guest state merge
**Status:** Pending user sign-off (Gate 2)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Sign-up → demo SMS → code → account, signed in, back to `returnTo` | Pass | API and component tests; E2E from product page |
| 2 | Invalid fields, common password, existing email/mobile → inline errors, nothing created | Pass | `auth.test.ts`; `Auth.test.tsx` |
| 3 | Mobile + OTP sign-in; unknown number → Sign up with number kept | Pass | Both suites; E2E |
| 4 | Wrong code shows attempts left; 5 → new code; expired → Resend; resend after 30 s | Pass | `auth.test.ts` (attempts, expiry, resend timing, hourly cap) |
| 5 | Password sign-in with email or mobile; generic error; lockout after 5 in 15 minutes | Pass | `auth.test.ts`; `Auth.test.tsx` |
| 6 | Forgot password → signs in; other sessions end | Pass | `auth.test.ts`; E2E across two browsers |
| 7 | Header states; session survives reload; 30-day rolling | Pass | Tests; expiry test; E2E |
| 8 | Cart merge: larger quantity; both sides kept; problems flagged | Pass | `auth.test.ts`; E2E (laptop 2 vs 1 → 2, plus iPhone) |
| 9 | Wishlist union capped at 100 | Pass | `auth.test.ts` |
| 10 | History merged, visible on another browser; cleared on sign-out | Pass | `auth.test.ts` (sync); `Auth.test.tsx`; E2E second browser |
| 11 | After sign-out: empty guest; signing back in restores | Pass | E2E; `auth.test.ts` (old cookie cannot reach the account cart) |
| 12 | `returnTo` exact (with size); external ignored | Pass | `Auth.test.tsx` |
| 13 | No plain-text passwords or codes; HTTP-only cookies; non-JSON POSTs rejected | Pass | `auth.test.ts` |
| 14 | Keyboard, announced errors, 360 px | Pass | Labelled fields with `aria-describedby` and `aria-invalid`; focus to first error; E2E mobile |

## 2. Test results summary

244 unit/API/component tests; 29 E2E tests passing on 3 repeated runs, plus a 75-run stress of the auth suite; typecheck and build clean.

## 3. Known issues and limitations

- **Demo codes:** codes are shown on screen (simulated SMS, ADR-003). The `demoCode` field must be removed before any real deployment.
- **In-memory rate limits:** password lockout counters reset when the API restarts (ADR-003).
- **Account existence:** the code sign-in route says whether a number has an account (a deliberate UX choice, ADR-003).
- **Not yet built:** profile editing and account deletion are not included. Addresses (F-007) and orders (F-010) come later.

## 4. Deviations from the approved specification

None.

## 5. Documentation updated

- [x] specification.md, intent.md, technical-design.md, test-plan.md; ADR-003 accepted
- [x] open-questions (Q12, Q13), project-state, project-plan, backlog, conversation logs

## 6. User sign-off (Gate 2)

- [ ] Accepted by user — date:
