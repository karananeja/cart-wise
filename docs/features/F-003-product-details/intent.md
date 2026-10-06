# Feature Intent

**Feature:** F-003 — Product details, sizes and recently viewed
**Status:** Approved
**Approved by / date:** User, 2026-10-06

---

## 1. In one sentence

The product page gives shoppers everything they need to decide (images, honest price and stock, and their size), and the store remembers what they looked at so they can get back to it.

## 2. Intended behavior

- **Product page:**
  - gallery with thumbnails, arrows, keyboard and swipe;
  - next to it: brand, title, star rating, price and discount, and availability;
  - for clothing and shoes, a row of size buttons.
- **Sizes:** sizes that are sold out are shown struck through and can't be picked. Picking a size that's nearly gone says "Only 2 left in M". The chosen size stays in the link.
- **Sized products elsewhere:** cards, filters and search treat a sized product as out of stock only when every size is gone.
- **Product information:** description and specifications sit below, followed by customer reviews (stars, name, comment; no labels). The star rating everywhere is the average of those reviews, so they always agree.
- **Recently viewed:**
  - products you open appear in a "Recently viewed" row on the homepage (newest first, up to 20, with a Clear button);
  - also on other product pages;
  - prices and stock in the row are always current.
- **No Add to cart button yet.** It arrives with F-004, so nothing on the page is non-working.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| No size preselected | Avoids accidental orders in the wrong size |
| Sold-out sizes visible but struck through | Users learn the size exists and is gone, rather than wondering |
| Size kept in the URL | Shareable and reload-safe; F-004 picks it up |
| Same price for every size | Simple and typical; per-size pricing adds complexity without value here |
| Recently viewed: 20 items, per device, fetched fresh | Bounded, private, never shows stale prices |
| Reviews shown unlabelled; rating = their average | Q5 (corrected) and Q15; the footer already states reviews are simulated |

## 4. What this feature deliberately does not do

Add to cart, wishlist, writing reviews, related or "frequently bought together" products, size guide, colours, zoom, delivery estimates.

## 5. How we will know it works

Acceptance criteria 1–12 in `specification.md` §17.

## 6. Decisions needed before implementation

Resolved 2026-10-06: size sets approved as proposed; Q5 corrected (show reviews, unlabelled); Q15 rating = review average.

## 7. Approval

- [x] Approved for implementation (Gate 1) — 2026-10-06
