# ADR-006: Email OTP over SMTP, with an On-Screen Demo Fallback

**Status:** Proposed (with F-016 Gate 1)
**Date:** 2026-10-07

## Decision

One-time codes for sign-up, sign-in and password reset go to the account's **email** instead of a mobile number. They are sent through any standard SMTP server configured in `apps/api/.env`, using `nodemailer`. Without SMTP settings, the code is returned to the client and shown as a labelled demo, as before. This amends ADR-003: the mobile OTP and "no real messages" parts are replaced; sessions, password hashing and the JSON-only POST guard are unchanged.

## Context

- ADR-003 simulated mobile OTP: codes were shown on screen and nothing was really sent.
- The user asked to send real codes, first considering MSG91 SMS (2026-10-07).
- MSG91 has no permanent free tier, only trial credits and a startup programme. Branded SMS in India needs DLT registration (₹5,000 + GST plus template approval). Without DLT, only MSG91's OTP widget with an unbranded default template works.
- The user chose email OTP replacing mobile OTP, sent through any SMTP server, keeping the demo fallback.

## Options Considered

1. **MSG91 SMS through the OTP widget:** no DLT needed, but unbranded, paid after the trial, and the OTP flow moves into MSG91's script.
2. **MSG91 SendOTP API with a DLT template:** branded, but needs DLT entity and template registration first.
3. **MSG91 Email OTP:** needs a domain the user owns, verified with DNS records.
4. **Generic SMTP with `nodemailer` (chosen):** works with MSG91's SMTP, Brevo (free, single verified sender) or a Gmail app password, and needs no vendor SDK.

## Decision

Option 4:
- A `mailer` module reads `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` and `SMTP_SECURE`. Partial settings are treated as "not configured" and logged as such.
- `demoCode` is returned only when no mailer is configured.

## Reason

- No cost or registration for a demo.
- Not locked to one vendor.
- Email becomes verified.
- Tests and offline runs keep working through the demo path.

## Consequences

- **Database schema v4:** `users.mobile` becomes optional and non-unique, and `email_verified_at` is added. OTP tables are keyed by email.
- Password sign-in accepts email only.
- A per-IP send limit is added to protect third-party inboxes.
- Email deliverability (spam folders) depends on the user's SMTP provider.
- Delivery OTP and bank OTP remain simulated (unchanged).
- The SMTP password lives only in the git-ignored `.env` and is never logged.
