# Test Plan — F-018 Site footer with newsletter and help pages

| Level | File | Covers |
|---|---|---|
| API | `apps/api/src/newsletter/newsletter.test.ts` | Subscribe new (normalised, hash only), duplicate (same answer, one row), invalid (field error), per-IP limit and reset after an hour; welcome email via a fake mailer (subject, demo wording, link with token and `WEB_BASE_URL`); lookup does not unsubscribe; POST unsubscribes; link reuse → 404; no second email to an active subscriber; re-subscribe issues a new token and email; mailer failure still 200 and logs only the code; unknown/missing/oversized tokens → 404 |
| Component | `apps/web/src/app/Footer.test.tsx` | Columns and links, bottom bar and Store simulation link; top-6 categories in order; All products only when categories fail; decorative groups have no links, buttons or focusable elements and say "coming soon"; collapsed `<details>` on narrow screens |
| Component | `apps/web/src/features/newsletter/Newsletter.test.tsx` | Success (polite status, event without email), already subscribed, invalid inline, submitting spinner/disabled, rate limited, network error; unsubscribe page skeleton → confirm → done, unknown token, no token |
| Component | `apps/web/src/features/help/Help.test.tsx` | Delivery, returns and payments pages show values computed from the shared constants (₹999, zone days, 10-minute hold, 7 days, EMI minimums, offers) |
| E2E | `e2e/footer.spec.ts` | Subscribe from the footer (invalid, then success); open a help page from the footer and switch topic; 360 px: collapsed sections expand, newsletter visible, no horizontal scroll |
| Manual | Screenshots 1280 px / 360 px | Footer, help pages and unsubscribe page layout |

Existing tests that looked up the header's Cart/Wishlist links or the login Email field by name were scoped to the header (`banner`) or made exact, since the footer now has links and a field with the same names.
