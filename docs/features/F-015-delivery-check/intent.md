# Feature Intent

**Feature:** F-015 — Pincode delivery check
**Status:** Approved (Gate 1, 2026-10-07)
**Approved by / date:** User, 2026-10-07

---

## 1. In one sentence

Shoppers can check on any product page whether their pincode gets delivery, by when, and whether Express is available. Checkout follows the same rules.

## 2. Intended behavior

- **Product page:** a "Delivery" line under Add to cart. Typing a pincode and choosing **Check** shows:
  - "Delivery to 560038"
  - Standard "Arrives by Fri, 10 Oct" with its price
  - Express's date and price, or "Express not available here"
- **Not serviceable:** "We don't deliver to 744101 yet". Add to cart still works.
- **Remembered:** the pincode is kept on the device and shown on every product page with **Change**. Signed-in shoppers start with their default address's pincode.
- **Checkout:**
  - Delivery options and dates follow the address's pincode.
  - Remote addresses get Standard only.
  - An unserviceable address can't continue, and says why.
- **Zones** (simulated, by pincode prefix):

| Zone | Standard | Express |
|---|---|---|
| Metro (Delhi/NCR, Mumbai, Pune, Ahmedabad, Hyderabad, Bengaluru, Chennai, Kolkata) | 2–3 days | 1–2 days |
| Regional (rest of India) | 3–5 days | 2–3 days |
| Remote (J&K/Ladakh, Sikkim, North-East) | 6–9 days | — |
| Not serviceable (Andaman & Nicobar, Lakshadweep, Army Post) | — | — |

  Delivery prices are unchanged.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| Checked locally from shared rules | Instant answer, identical to checkout |
| Dates, not zone names | Shoppers care when it arrives, not what we call the area |
| Unserviceable doesn't block Add to cart | Browsing and the cart stay free; checkout is where it matters |
| Typed pincode beats default address | Shoppers often check for someone else |

## 4. What this feature deliberately does not do

- A real pincode directory or town names.
- Cash on delivery.
- Per-product delivery restrictions.
- The check on the cart, listing or wishlist pages (backlog).

## 5. How we will know it works

Acceptance criteria in `specification.md` §17.

## 6. Decisions needed before implementation

Resolved 2026-10-07: approved as proposed. (D1: confirm the zone table (prefixes and days in `specification.md` FR-1).)

## 7. Approval

- [x] Approved for implementation (Gate 1) — 2026-10-07
