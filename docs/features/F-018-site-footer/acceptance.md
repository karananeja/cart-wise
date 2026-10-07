# Acceptance

**Feature:** F-018 — Site footer with newsletter and help pages
**Status:** Accepted (Gate 2, 2026-10-07)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Footer on every page: Brand, Shop, Your account, Help, Newsletter; bottom bar with demo notice | Pass | Component; E2E; screenshots |
| 2 | Shop lists the 6 largest categories and All products | Pass | Component (incl. fallback to All products when categories fail) |
| 3 | Help pages open; numbers match the app's rules | Pass | Component tests compare with shared constants (free delivery ₹999, prices, zone days, 10-minute hold, 7-day returns, offers, EMI minimums and tenures) |
| 4 | Subscribing shows success; repeating shows the same and stores one row | Pass | API; component; E2E |
| 5 | With SMTP, a welcome email arrives; its unsubscribe link opens the page and confirming unsubscribes | Pass | API with a fake mailer (link with token, no second email for an active subscriber, failure still 200); component and E2E for the unsubscribe page |
| 6 | Social icons and badges aren't focusable or clickable; "coming soon" for screen readers | Pass | Component (no links or buttons in those groups) |
| 7 | 360 px: link columns collapse; no overflow | Pass | E2E 360 px; screenshots |

## 2. Test results summary

- `pnpm test`: 577 passing (shared 75, API 285, web 217), 26 of them new.
- `pnpm e2e`: 62 passing, 3 of them new.
- Typecheck clean.

## 3. Known issues and limitations

- Subscribers who sign up while SMTP isn't set up get no welcome email. Their unsubscribe link only exists in that email.
- The per-IP sign-up limit is kept in memory and resets when the API restarts, like the sign-in limiter.

## 4. Deviations from the approved specification

- **No schema version bump:** the new table is created automatically by `CREATE TABLE IF NOT EXISTS`.
- **At 360 px only Shop, Your account and Help collapse.** Brand and the newsletter stay open, so the footer's one action stays visible.
- **The footer brand name is text, not a second home link.**
- **Help copy that isn't driven by a constant:** "first 6 / last 4 digits" of a card is fixed text, because no shared constant exists for it.

## 5. Other changes

- **Existing tests:** some now scope link lookups to the header, because the footer repeats names such as Cart and Wishlist.
- **Checkout E2E:** a mobile test now waits for the cart update before leaving the page. Under the extra load it had been cut off.

## 6. Documentation updated

- [x] technical-design, test-plan, conversation-log, `.env.example` (`WEB_BASE_URL`)

## 7. User sign-off (Gate 2)

- [x] Accepted by user — date: 2026-10-07 ("accept")
