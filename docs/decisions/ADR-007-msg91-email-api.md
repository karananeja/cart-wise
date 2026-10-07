# ADR-007: MSG91 Email API for One-Time Codes and Newsletter Email

**Status:** Accepted (user request, 2026-10-07)
**Date:** 2026-10-07
**Supersedes:** the transport part of ADR-006 (SMTP via Nodemailer). ADR-006's other decisions still stand: codes go to email, and the on-screen demo fallback stays.

## Decision

Send one-time code emails, and the newsletter welcome email, through the **MSG91 Email API** (`POST https://control.msg91.com/api/v5/email/send`, `authkey` header, a template stored in MSG91 plus variables).
- The MSG91 OTP Widget/API is **not** used. The backend still generates, hashes and verifies its own 6-digit codes.
- SMTP and Nodemailer are removed.

## Context

The user asked for MSG91 Email specifically, with:
- codes generated and verified by the backend;
- a 5-minute expiry, 5 attempts and a 60-second resend cooldown;
- the previous code invalidated on resend, and the code deleted once verified;
- credentials kept on the server, in `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID`;
- compatibility with a future Vercel deployment.

The newsletter welcome email (F-018) also used Nodemailer. The user chose to move it to MSG91 too.

## Options Considered

1. **Keep SMTP and point it at MSG91's SMTP service.** Rejected: the user ruled out SMTP and Nodemailer.
2. **MSG91 OTP Widget/API.** Rejected by the user. It would also move code generation and verification out of the backend.
3. **MSG91 Email API over HTTPS (chosen).**

## Decision details

- **Settings:**
  - Required: `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, and `MSG91_FROM_EMAIL` (the API needs a sender on the verified domain).
  - Optional: `MSG91_DOMAIN` (defaults to the sender's domain), `MSG91_FROM_NAME`, `MSG91_NEWSLETTER_TEMPLATE_ID`, and `MSG91_API_URL` (for tests and fakes only).
  - `MSG91_INTEGRATION_ID` isn't used: the Email API send call doesn't take one.
- **Template variables:**
  - OTP: `otp`, `purpose`, `minutes`, `store`.
  - Newsletter: `unsubscribe_url`, `store`.
- **Failures:** a non-2xx response, `hasError: true` or `status: "fail"` counts as a failure, as do network errors and a 10 s timeout. The log gets only a short code, such as `HTTP 401`.
- **Code lifecycle:** the existing `otp_challenges` table, hashes only. A resend stores the new hash before sending, so the old code is invalid even if the send fails, and the cooldown restarts only after a successful send. A verified code's row is deleted.

## Reason

- It is what the user asked for.
- It is plain HTTPS with no extra packages, so it works on serverless hosts. All OTP state is in the database, with nothing kept in memory between requests.

## Consequences

- The domain must be verified and the templates approved in the MSG91 panel before real emails go out. Until then, the demo fallback keeps working.
- The request body follows MSG91's v5 Email API format as documented in the panel's API Integration page. It is built in one function (`msg91EmailRequest`) so it is easy to compare and adjust.
- **Vercel:** the email path is serverless-safe, but the API as a whole isn't yet. It uses SQLite on local disk and background timers (holds, simulation). Deploying it needs a hosted database and scheduled jobs, which is separate production work.
