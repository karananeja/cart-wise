# Feature Intent

**Feature:** F-012 — Product discovery (related products, frequently bought together, continue shopping)
**Status:** Approved (Gate 1, 2026-10-06)
**Approved by / date:** User, 2026-10-06

---

## 1. In one sentence

Product, home and cart pages suggest relevant products using simple, explainable rules, with titles that always say why they're shown, and a one-tap way to add a product with its companions.

## 2. Intended behavior

- **Product page:**
  - **Frequently bought together** appears only when 2 or more real orders had both items. Otherwise it's **Pairs well with**, from a category map (phone → accessories, dress → shoes and jewellery…).
  - The pairing group shows ticked companions, the combined price, and **Add both to cart**. Items that need a size say **Choose size** instead.
  - Below it, **You may also like**: similar items from the same category, ranked by shared tags, brand and price, with sold-out items last.
- **Homepage** for returning visitors:
  - **Still in your cart** (thumbnails, subtotal, Go to cart);
  - **Because you viewed ‹product›**;
  - for signed-in customers with orders, **Because you bought ‹product›**.
  - First-time visitors see today's homepage.
- **Cart:** one **Pairs well with your cart** rail, below the checkout button.
- **Analytics:** the brief's `recommendation_clicked` is finally recorded.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| Honest titles ("Frequently bought together" only with real data) | No fabricated social proof (CLAUDE.md §13) |
| Rules, not AI | Brief §17: start deterministic; easy to explain and test |
| One-tap bundle add, no blind size picks | Saves taps without adding the wrong size |
| Suggestions below the main action, hidden on failure | They help but never get in the way |

## 4. What this feature deliberately does not do

- AI recommendations
- Wishlist-based suggestions
- Bundle discounts
- Trending badges
- Recommendation emails

## 5. How we will know it works

Acceptance criteria 1–8 in `specification.md` §17.

## 6. Decisions needed before implementation

Resolved 2026-10-06: complementary category map approved as drafted.

## 7. Approval

- [x] Approved for implementation (Gate 1) — 2026-10-06
