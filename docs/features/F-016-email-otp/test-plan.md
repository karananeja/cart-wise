# Test Plan — F-016 Email OTP

| Level | File | Covers |
|---|---|---|
| Unit | `packages/shared/src/auth.test.ts` | `maskEmail` (long and 1-char local parts, non-email); sign-up with no or blank mobile; mobile normalised or rejected when given |
| Unit | `apps/api/src/mail/mailer.test.ts` | Config missing, blank, partial (names missing keys, never the password), bad port, complete; `SMTP_SECURE` or port 465 |
| API | `apps/api/src/auth/auth.test.ts` | Demo mode for every flow: `maskedEmail`, `delivery: 'demo'`, `email_verified_at` on sign-up; sign-up without mobile; shared mobile allowed, `EMAIL_TAKEN` kept; code sign-in by email, `NO_ACCOUNT`, invalid email, mobile refused; password by email only with the generic error; lock per email; reset by email; 5 per email per hour |
| API | same file, "email delivery" | Fake mailer: no `demoCode` for sign-up, login, resend and reset; subject, purpose, 5 minutes, ignore line, no links; `502 EMAIL_FAILED` with nothing stored, a log without secrets, and failures counted toward the limit; a failed resend keeps the old code |
| API | same file, "per-IP code limit" / "accounts from before F-016" | 21st code from one IP refused, allowed again after an hour, override option; legacy account signs in by code, email becomes verified once |
| API | `apps/api/src/db/database.test.ts` | v3 → v4: users keep ids, mobiles and data; sessions, carts, wishlists, addresses and orders still linked; foreign keys enforced and cascading; nullable, non-unique mobile; OTP tables keyed by email; no reseed; idempotent reopen |
| API | `apps/api/src/payments/razorpay.api.test.ts` | Razorpay prefill without `contact` when the account has no mobile |
| Component | `apps/web/src/features/auth/Auth.test.tsx` | Demo banner copy in sign-up, sign-in and reset; email validation; unknown email → sign-up with the email kept; password sign-in error copy; email mode: "We emailed a code to …", no code shown, spam hint after 30 s, sign-up without mobile, reset; `EMAIL_FAILED` alert, then retry; account page without mobile |
| E2E | `e2e/auth.spec.ts`, `checkout.spec.ts`, `addresses.spec.ts` + API-driven specs | Existing flows on the demo path ("Demo email to"); code sign-in by email; password sign-in and reset by email; sign-up without mobile (forgot-password test); address mobile prefill when given. Playwright blanks `SMTP_*` and raises the per-IP limit for its API |
