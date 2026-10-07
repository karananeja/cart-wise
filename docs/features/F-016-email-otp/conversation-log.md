# Conversation Log — F-016 — Email OTP (replaces mobile OTP)

| Date | Topic | Decision / Outcome | Notes |
|---|---|---|---|
| 2026-10-07 | Request + direction | See `docs/conversation-log.md` 2026-10-07 entries | User |
| 2026-10-07 | Spec + intent drafted | Presented for Gate 1 | None (decided 2026-10-07). ADR-006 is proposed for acceptance with this gate. |
| 2026-10-07 | Gate 1 | **Approved** as proposed | |
| 2026-10-07 | Implementation complete (sub-agent, reviewed) | Tested incl. a real SMTP run against a local server; awaiting Gate 2 | Deviations in acceptance §4 |
| 2026-10-07 | Gate 2 | **Accepted** | |
| 2026-10-07 | Change request | MSG91 Email API only (no OTP widget, no SMTP/Nodemailer); backend codes, 5 min, 5 attempts, 60 s resend, invalidate on resend, delete on success; newsletter welcome moved to MSG91 too (user choice); ADR-007 | Implemented and tested (local fake MSG91); real send needs the user's verified domain and template |
