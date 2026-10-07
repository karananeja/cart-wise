# Feature Specification

## Feature

**ID:** F-018
**Name:** Site footer with newsletter and help pages
**Status:** Approved (Gate 1, 2026-10-07)

---

## 1. Objective

Give the store a full footer like a real shop. It has link columns, three short help pages that state the app's actual rules, a working newsletter sign-up, and decorative social icons and app badges, while keeping the demo notice.

## 2. User Problem

The footer is just a demo notice and a copyright line. Shoppers have nowhere to find delivery, returns or payment rules, and the site feels unfinished at the bottom of every page.

## 3. User Intent

"Where do I find the rules, my account links, or how to hear about offers?"

## 4. User Stories

- As a shopper, I can reach popular categories, my account pages and help pages from the bottom of any page.
- As a shopper, I can read how delivery, returns and payments work here.
- As a shopper, I can subscribe to the newsletter with my email and unsubscribe later.

## 5. Functional Requirements

**FR-1 Columns** (stacked as accordions under `sm`, a grid on wider screens):
- **Brand:** Cartwise logo/name, a one-line tagline, the decorative social icons and the app badges.
- **Shop:** the 6 categories with the most products (from `/categories`), plus All products.
- **Your account:** Account, Orders, Wishlist, Cart, Addresses. Signed-out shoppers clicking an account link go through sign-in with a return path (existing behaviour).
- **Help:** Delivery, Returns & refunds, Payments & EMI.
- **Newsletter:** an email field and **Subscribe**.

**FR-2 Help pages** (`/help/delivery`, `/help/returns`, `/help/payments`). Short static pages that state the **real rules from code**:
- **Delivery:** charges, free over ₹999, Standard/Express, zone dates (F-015, if built first; otherwise the current dates), 10-minute stock hold, delivery code.
- **Returns & refunds:** cancel before shipping with an instant refund, return within 7 days of delivery, delivery charge not refunded on returns, refund to the original method.
- **Payments & EMI:** demo card/UPI, bank offers, EMI and no-cost EMI rules, Razorpay test mode; no real money.

Numbers come from shared constants where they exist, so the pages can't drift.

**FR-3 Newsletter.**
- **Subscribe:** POST saves the email. The same success message is shown for a new or an already-subscribed address ("You're subscribed. Thanks!"), so subscription status isn't revealed.
- If SMTP is configured (F-016 mailer), a welcome email is sent with an **unsubscribe link**. No other emails are sent; there are no campaigns.
- The unsubscribe link opens `/newsletter/unsubscribe?token=…`. The page asks "Unsubscribe k••••@gmail.com?" and has a button. A link scanner opening the page doesn't unsubscribe the address.
- Invalid email: inline error. Rate limit: 10 subscriptions per IP per hour.

**FR-4 Decorative items.**
- Instagram, X, YouTube and Facebook icons (inline SVG), plus "App Store" and "Google Play" badges styled as badges.
- They are **not links or buttons**. They are grouped under "Follow us (coming soon)", with the text read by screen readers, and they're slightly muted.

**FR-5 Bottom bar.**
- The demo notice (kept).
- "© 2026 Cartwise demo".
- "Store simulation" link to `/sim`, labelled for demo use.

## 6. Non-Functional Requirements

- The footer loads with the page. Categories come from the cached categories query; if it fails, the Shop column shows only All products.
- Accessibility: `footer` landmark, headed columns, accordions as native `<details>` on mobile.
- 360 px works.

## 7. UX Requirements

- The newsletter is the only interactive form in the footer, with one action.
- Nothing in the footer leads to a fake or empty page.

## 8. UI Requirements

- `Footer` (rewritten), `NewsletterForm`, `HelpPage` layout with three content pages, and `UnsubscribePage`.
- Newsletter states: idle, submitting, success, error, rate-limited, invalid.

## 9. Data Requirements

`newsletter_subscribers`:
- `email` (unique, normalised)
- `token` (random, for unsubscribe; only a hash is stored)
- `created_at`
- `unsubscribed_at` (null while subscribed; re-subscribing clears it)
- `source` (`footer`)

Schema version bump (additive table).

## 10. API Requirements

- `POST /newsletter` `{email}` returns `200 {ok:true}`. Errors: `400 INVALID_EMAIL`, `429 TOO_MANY_REQUESTS`.
- `GET /newsletter/unsubscribe?token=` returns `{maskedEmail}` or `404`.
- `POST /newsletter/unsubscribe` `{token}` returns `200`.
- Welcome-email links use a `WEB_BASE_URL` setting (default `http://localhost:5173`).

## 11. State Management

Local form state, plus one mutation.

## 12. Loading States

Subscribe button spinner. The unsubscribe page shows a skeleton while it looks up the token.

## 13. Empty States

N/A.

## 14. Error States

- Network failure: "Couldn't subscribe right now. Please try again."
- Unknown or expired unsubscribe token: "This link isn't valid anymore."
- A welcome-email failure is logged and not shown. The subscription still succeeds.

## 15. Security Considerations

- Unsubscribe tokens are random, and only hashes are stored.
- No subscription enumeration (same message for new and existing addresses).
- Per-IP rate limit.
- The unsubscribe action is a POST.

## 16. Analytics

New event `newsletter_subscribed` (no email in the event).

## 17. Acceptance Criteria

1. Every page shows the footer with the Brand, Shop, Your account, Help and Newsletter columns, and the bottom bar with the demo notice.
2. Shop lists the 6 largest categories and All products. Each link opens its listing.
3. The three help pages open and their numbers match the app's rules (free delivery threshold, 7-day returns, hold time, EMI minimums).
4. Subscribing shows the success message. Subscribing again shows the same message and stores one row.
5. With SMTP configured, a welcome email arrives. Its unsubscribe link opens the page, and confirming unsubscribes.
6. Social icons and app badges aren't focusable or clickable, and screen readers hear "coming soon".
7. At 360 px the columns are collapsible sections and nothing overflows.

## 18. Testing Strategy

- **API:** subscribe (new, duplicate, invalid, rate limit), unsubscribe (token lookup, POST, reuse, unknown), welcome email through a fake mailer.
- **Component:** footer columns, newsletter states, decorative items not focusable.
- **E2E:** subscribe from the footer and open a help page.

## 19. Dependencies

F-016 mailer, for the welcome email only. Without it, subscribe still works and simply sends nothing. F-015 for the zone text on the delivery help page.

## 20. Out of Scope

- Newsletter campaigns or any emails besides the welcome email.
- Real social accounts or app-store listings.
- About, Careers, Terms and Privacy pages.
- Language or region switchers.

## 21. Assumptions

- The user's choice of a "full marketing footer" includes the help pages from the recommended option, plus the newsletter and decorative items.

## 22. Decisions Required From User

D1: confirm the footer includes the three help pages (assumption above), and the "Store simulation" link in the bottom bar.
