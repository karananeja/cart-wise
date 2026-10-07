# Feature Intent

**Feature:** F-018 — Site footer with newsletter and help pages
**Status:** Awaiting Approval
**Approved by / date:** —

---

## 1. In one sentence

Every page ends with a full store footer: shop and account links, three help pages stating the real rules, a working newsletter sign-up, decorative social icons and app badges, and the demo notice.

## 2. Intended behavior

- **Columns:**
  - Brand (tagline, social icons, app badges)
  - Shop (6 biggest categories + All products)
  - Your account
  - Help (Delivery, Returns & refunds, Payments & EMI)
  - Newsletter

  On phones they become collapsible sections.
- **Help pages:** short and plain, and their numbers come from the app's own constants (₹999 free delivery, 7-day returns, 10-minute hold, EMI minimums…).
- **Newsletter:**
  - Subscribing always says "You're subscribed. Thanks!"
  - With SMTP, a welcome email with an unsubscribe link is sent. The link opens a page where one button confirms.
- **Social icons and app badges:** shown, muted and labelled "coming soon". They are not links, so nothing leads to a fake page.
- **Bottom bar:** the demo notice, © 2026 Cartwise demo, and a "Store simulation" link.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| Help pages read shared constants | They can't drift from real behaviour |
| Same message for new or existing subscribers | Doesn't reveal who is subscribed |
| Unsubscribe needs a click on the page | Mail scanners opening links can't unsubscribe people |
| Decorative items not focusable | No dead ends for keyboard or screen-reader users |

## 4. What this feature deliberately does not do

- Campaign emails.
- Real social or app-store links.
- About, Terms and Privacy pages.
- Language or region switchers.

## 5. How we will know it works

Acceptance criteria in `specification.md` §17.

## 6. Decisions needed before implementation

D1: confirm the three help pages and the "Store simulation" link belong in your "full marketing footer".

## 7. Approval

- [ ] Approved for implementation (Gate 1)
