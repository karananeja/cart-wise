# Acceptance

**Feature:** F-016 — Email OTP (replaces mobile OTP)
**Status:** Pending user sign-off (Gate 2)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Without SMTP: sign-up, code sign-in, reset work with the on-screen demo email code; start-up log says so | Pass | API and component tests (demo mode); E2E; manual run (log "Email codes are shown on screen (demo)…") |
| 2 | With SMTP: code arrives by email, no code in the API response, screen says it was emailed | Pass | API tests with a fake mailer; **manual run against a local SMTP server**: email received ("387604 is your Cartwise code", text + HTML), response `delivery: "email"` without `demoCode`, sign-up completed with the emailed code |
| 3 | Sign-up without mobile works; a given mobile prefills the address form | Pass | API; component; manual (`mobile: null`) |
| 4 | Password sign-in with email; mobile refused with the generic error | Pass | API |
| 5 | Pre-upgrade account signs in by email code, email becomes verified, its data intact | Pass | v3 → v4 migration test (ids, sessions, carts, wishlists, addresses, orders); your `store.db` upgraded to v4 with 1 user, 8 orders, 2 addresses, no broken links |
| 6 | 6th code to one email in an hour, or 21st from one IP, refused clearly | Pass | API |
| 7 | SMTP failure → "We couldn't send the code" with retry; no crash; password never logged | Pass | API; manual (mail server stopped → `502 EMAIL_FAILED`, log shows only `ESOCKET`; password absent from log) |
| 8 | Delivery OTP and bank OTP still on screen | Pass | Existing order and payment tests and E2E unchanged and passing |
| 9 | Existing auth, checkout and E2E flows pass on the demo path | Pass | 58/58 E2E |

## 2. Test results summary

- `pnpm test`: 546 passing (shared 75, API 276, web 195), 23 of them new.
- `pnpm e2e`: 58 passing. One earlier run had a timing failure in the simulation spec, which doesn't involve auth; the re-runs were clean.
- Typecheck clean.

## 3. Known issues and limitations

- **Deliverability:** whether codes land in the inbox or spam depends on your SMTP provider and sender address.
- **Per-IP limit:** it uses the connecting address, which is right locally. Behind a proxy, Express's `trust proxy` would need setting.
- **Existing accounts:** their emails were never verified. The first code sign-in or reset verifies them.

## 4. Deviations from the approved specification

- **New setting `OTP_MAX_SENDS_PER_IP_PER_HOUR`** (default 20). E2E raises it, because its tests sign up many shoppers from one machine.
- **Playwright blanks `SMTP_*`,** so E2E never sends real email even when your `.env` has SMTP settings.
- **A successful reset code also verifies the email,** not only a code sign-in: it proves the same inbox.
- **Retry on a failed first send:** the alert says to try again, and the **Send code** button below it is the retry. An explicit **Try again** button appears only when a resend fails.
- **Sign-up field order:** the optional mobile field comes last.
- **Database:** the catalog reseed now has its own version (3), so this upgrade (schema 4) kept your simulated stock.

## 5. To send real emails

Add to `apps/api/.env`, then restart `pnpm dev`. It logs "Email codes are sent through …".

```
SMTP_HOST=smtp-relay.brevo.com   # or smtp.gmail.com (app password) / MSG91 SMTP
SMTP_PORT=587
SMTP_USER=…
SMTP_PASS=…
SMTP_FROM=Cartwise <you@yourdomain-or-verified-sender>
```

## 6. Documentation updated

- [x] specification, intent, technical-design, test-plan, conversation-log, ADR-006, README, `.env.example`

## 7. User sign-off (Gate 2)

- [ ] Accepted by user — date:
