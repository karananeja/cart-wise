# Feature Intent

**Feature:** F-016 — Email OTP (replaces mobile OTP)
**Status:** Awaiting Approval
**Approved by / date:** —

---

## 1. In one sentence

Sign-up, code sign-in and password reset use a 6-digit code sent to the shopper's email. It is really sent when SMTP is set up, and shown on screen as a demo when it isn't.

## 2. Intended behavior

- **Sign up:**
  - Fields: name, email, password, and mobile (optional).
  - A code arrives by email. Entering it creates the account and signs in. The guest cart and wishlist merge as today.
- **Sign in:**
  - Default: email, then a code.
  - "Use password instead": email + password. Mobile can't be used to sign in any more.
- **Forgot password:** email, then a code, then a new password.
- **With SMTP** (`SMTP_*` in `apps/api/.env`): "We emailed a code to k••••@gmail.com", a spam-folder hint and Resend.
- **Without SMTP:** "Demo email to k••••@gmail.com: your code is 123456", as today's demo SMS banner.
- **Existing accounts:** keep everything. They sign in by email code or password, and their email becomes verified on first code sign-in.
- **Unchanged:** delivery codes and the bank payment OTP stay on screen.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| Any SMTP via nodemailer (ADR-006) | Free with Brevo or Gmail; no DLT or vendor lock-in |
| Demo fallback kept | Tests, E2E and offline runs need no mail server |
| Password sign-in by email only | Mobile is no longer unique |
| Per-IP send limit | Sign-up could otherwise flood a stranger's inbox |
| No links in OTP emails | Less phishing-like; the code is enough |

## 4. What this feature deliberately does not do

- SMS or MSG91's SMS widget.
- Magic links.
- Changing email or mobile.
- Order notification emails (backlog).

## 5. How we will know it works

Acceptance criteria in `specification.md` §17.

## 6. Decisions needed before implementation

None (decided 2026-10-07). ADR-006 is proposed for acceptance with this gate.

## 7. Approval

- [ ] Approved for implementation (Gate 1)
