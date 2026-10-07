# Feature Specification

## Feature

**ID:** F-016
**Name:** Email OTP (replaces mobile OTP)
**Status:** Proposed

---

## 1. Objective

Sign-in codes, sign-up verification and password reset use **email** instead of mobile. Codes are really sent when SMTP is configured, and shown on screen as a labelled demo when it isn't. See ADR-006.

## 2. User Problem

- Codes are shown on screen, so nothing proves the shopper owns the account's contact point.
- The email on an account is never verified.
- Real SMS in India costs money and needs DLT registration for branded templates. Email doesn't.

## 3. User Intent

"Send me a code to my email so I can sign in or prove the account is mine."

## 4. User Stories

- As a new shopper, I sign up with name, email and password. I confirm my email with a 6-digit code, and mobile is optional.
- As a returning shopper, I sign in with my email and a code, or with email and password.
- As a shopper who forgot my password, I get a reset code by email.
- As the person running the demo without SMTP, I still see the code on screen and everything works.

## 5. Functional Requirements

**FR-1 Sign-up.**
- Fields: Full name, Email, Password, and Mobile (optional, "for delivery updates").
- A code is emailed. Verifying it creates the account with `email_verified_at`, then signs in and merges guest state (as today).
- `409 EMAIL_TAKEN` still applies. `MOBILE_TAKEN` is removed, because mobile is no longer unique.

**FR-2 Code sign-in (default).**
- Email field, "We'll email you a one-time code".
- An unknown email shows "No account for this email. Sign up?" with the email prefilled. This keeps the ADR-003 choice of revealing whether an account exists on the code path.
- An existing account whose email was never verified gets `email_verified_at` set on its first successful code sign-in.

**FR-3 Password sign-in.**
- Email + password. Mobile is no longer accepted as an identifier, since it isn't unique.
- The generic error becomes "Incorrect email or password".

**FR-4 Forgot password.** Email only. The code goes to that email, then the flow continues as today: reset token, new password, all sessions revoked, signed in.

**FR-5 Delivery of codes.**
- **SMTP configured** (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, optional `SMTP_SECURE` in `apps/api/.env`):
  - The code is emailed.
  - The API response has **no** `demoCode`.
  - The screen says "We emailed a code to k••••@gmail.com".
- **Not configured:**
  - The response includes `demoCode`.
  - The screen shows "Demo email to k••••@gmail.com: your code is 123456. No real email is sent."
  - The API logs at start which mode is on. It never logs credentials or codes.
- **Send failure:** `502 EMAIL_FAILED`, "We couldn't send the code. Please try again." The failed send still counts toward the limits.

**FR-6 The email.**
- Subject: "123456 is your Cartwise code".
- Plain text plus simple HTML. It states the purpose (sign in / verify email / reset password), that it is valid for 5 minutes, and "If this wasn't you, ignore this email".
- No links.

**FR-7 Limits.**
- Unchanged per address: 6 digits, 5 minutes, 5 attempts, resend after 30 s, 5 codes per email per hour.
- **New:** 20 codes per IP per hour, so a stranger can't use sign-up to flood someone's inbox.

**FR-8 Mobile becomes an optional profile field.**
- Not unique, not verified. Existing users keep theirs.
- Address forms prefill it when present.
- Razorpay Checkout prefills the contact only when present.

**FR-9 Unchanged:** the delivery OTP (orders) and the bank payment OTP remain simulated on screen.

## 6. Non-Functional Requirements

- **Security:**
  - Codes are stored hashed, as today.
  - SMTP password only in `.env`.
  - `demoCode` is returned only when SMTP isn't configured.
  - Rate limits are stored in the database.
- **Reliability:** sending has a 10 s timeout. A failure is shown to the shopper with a retry.
- **Accessibility:** existing OTP input patterns are kept. The status text ("We emailed a code to …") is announced politely.
- **Maintainability:** one `mailer` module behind an interface (`send({to, subject, text, html})`). Tests inject a fake.

## 7. UX Requirements

- One primary action per step, as today.
- Copy changes from "mobile/SMS" to "email" throughout.
- "Check your spam folder" hint after 30 s alongside Resend, only in real-email mode.

## 8. UI Requirements

- LoginPage, SignupPage, ForgotPasswordPage, OtpStep: email copy.
- `DemoSmsBanner` becomes `DemoEmailBanner`, and a "sent" note is added for real mode.
- Account page shows the mobile only when present.

## 9. Data Requirements

Schema version 4:
- **`users` rebuilt, keeping all rows:**
  - `mobile` becomes nullable and not unique.
  - `mobile_verified_at` becomes nullable.
  - New `email_verified_at` (null for existing users).
- **`otp_challenges` and `otp_sends` are recreated keyed by `email`.** They hold only short-lived data, so pending codes at upgrade time are dropped.
- New `otp_ip_sends(ip, sent_at)` for FR-7.

## 10. API Requirements

- `POST /auth/signup` `{name, email, password, mobile?}`.
- `POST /auth/otp`:
  - `{purpose:'login', email}`
  - `{purpose:'reset', email}`
- `ChallengeResponse`: `{challengeId, maskedEmail, delivery: 'email' | 'demo', demoCode?, resendAfterSeconds, expiresInSeconds}`.
- `POST /auth/password` `{email, password}`.
- `PublicUser`: `{name, email, mobile: string | null, maskedMobile: string | null}`.
- New errors:
  - `502 EMAIL_FAILED`
  - `429 TOO_MANY_CODES` (now also per IP)

## 11. State Management

No change. Challenge state stays in component state, as today.

## 12. Loading States

Send buttons show a spinner while sending. A real SMTP send can take a few seconds.

## 13. Empty States

N/A.

## 14. Error States

- `EMAIL_FAILED`: an alert with Try again.
- Wrong or expired code, too many tries, and rate limits: as today, with email wording.

## 15. Security Considerations

- The per-IP limit protects strangers' inboxes.
- No links in OTP emails reduces phishing look-alikes.
- Existing accounts: proving email ownership by code is enough to sign in, which is the same trust as a reset.
- The ADR-003 account-existence trade-off is kept and documented.

## 16. Analytics

No new events. Server auth events are unchanged.

## 17. Acceptance Criteria

1. Without SMTP settings: sign-up, code sign-in and reset all work with the on-screen demo email code. The API logs "Email codes are shown on screen (demo)".
2. With SMTP settings: the code arrives by email. The API response contains no code, and the screen says it was emailed.
3. Sign-up without a mobile works. A mobile, if given, is saved and prefills the address form.
4. Password sign-in works with email. Using a mobile number is refused with the generic error.
5. An existing (pre-upgrade) account can sign in with email + code, and its email becomes verified. Its orders, addresses and wishlist are intact.
6. The 6th code to one email in an hour, or the 21st from one IP, is refused with a clear message.
7. An SMTP failure shows "We couldn't send the code" and a retry. Nothing crashes, and nothing is logged with the password.
8. Delivery OTP and bank OTP still show on screen.
9. All existing auth, checkout and E2E flows pass on the demo path.

## 18. Testing Strategy

- **Unit:** mailer config parsing (missing, partial, complete), email masking.
- **API:**
  - Every flow in both modes, using an injected fake mailer.
  - Per-IP and per-email limits.
  - Migration from schema v3 keeps users and links (legacy-row test).
  - Razorpay prefill without a mobile.
- **Component:** login, sign-up and reset in both modes.
- **E2E:** existing flows on the demo path (the helpers switch to email).

## 19. Dependencies

F-006 auth, ADR-003 (amended by ADR-006). New dependency: `nodemailer`.

## 20. Out of Scope

- SMS of any kind, and MSG91's SMS/widget.
- Magic links.
- Changing email or mobile from the profile.
- Email notifications for orders (backlog).
- Verifying mobile.

## 21. Assumptions

- The user provides their own SMTP account (MSG91 Email SMTP, Brevo, Gmail app password, etc.).
- Gmail/Brevo free sending limits are enough for a demo.

## 22. Decisions Required From User

None. Decided 2026-10-07: email replaces mobile; any SMTP with demo fallback.
