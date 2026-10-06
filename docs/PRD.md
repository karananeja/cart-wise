# Product Requirements Document — E-Commerce Application

**Status:** v1.0 — Phase 1 MVP delivered (F-001–F-011 accepted 2026-10-06)
**Last updated:** 2026-10-06

`PROJECT_BRIEF.md` is the source of truth for vision and scope. This PRD turns it into traceable requirements, priorities and open questions. Where the two disagree, the brief wins and this document is corrected.

---

## 1. Goal

A polished, commercially credible, locally runnable web store that demonstrates the complete modern shopping journey, using simulated integrations for payment and fulfilment.

Guiding principle: **rich surface, simple decisions.**

## 2. Users

| Persona | Description | Needs |
|---|---|---|
| Guest shopper | Arrives anonymously, explores | Browse, search, build a cart and wishlist without signing up |
| Registered shopper | Has an account | Check out, manage addresses, see and manage orders |
| Demo operator | Person demonstrating the store | Change inventory and advance orders through their lifecycle (Store Simulation Console) |

## 3. Primary journey

```text
Discover → Search / Browse → Product Details → Cart → Checkout → Payment → Order → Tracking → Retention
```

## 4. Requirements

Requirement IDs are stable and referenced by feature specifications. The full catalogue with acceptance notes is in `requirements/mvp-requirements.md`.

| Area | IDs | Priority |
|---|---|---|
| Discovery (home, categories, listing, filter, sort) | DISC-* | Must |
| Search (keyword, fuzzy, suggestions, no-result alternatives) | SRCH-* | Must |
| Search history | HIST-* | Must |
| Product details | PDP-* | Must |
| Recently viewed | RV-* | Must |
| Cart (guest + authenticated) | CART-* | Must |
| Wishlist | WISH-* | Must |
| Authentication + guest state merge | AUTH-* | Must |
| Address management | ADDR-* | Must |
| Checkout | CHK-* | Must |
| Simulated payment | PAY-* | Must |
| Orders | ORD-* | Must |
| Inventory | INV-* | Must (cross-cutting) |
| Application states | STATE-* | Must (cross-cutting) |
| Analytics | ANL-* | Must (cross-cutting) |
| Store Simulation Console | SIM-* | Must (Q6 resolved 2026-10-06; built in F-010 and F-011) |
| Reviews, related, frequently bought together, continue shopping, tracking timeline, notifications, price-drop / back-in-stock, discovery homepage | NEXT-* | Next |
| Semantic search, Help me find, AI recommendations, comparison, conversational shopping | AI-* | Optional / Experimental |

## 5. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | Runs locally with one install command and one start command. No paid services or API keys required for the MVP. |
| NFR-2 | Accessible: keyboard operable, visible focus, labelled controls, WCAG 2.2 AA colour contrast. |
| NFR-3 | Responsive from 360 px phones to wide desktop. |
| NFR-4 | Fast feedback: skeletons instead of blank screens, optimistic UI where safe, no layout shift from images. |
| NFR-5 | No real payments, no storage of card numbers or CVVs, passwords stored only as salted hashes. |
| NFR-6 | Frontend is not coupled to the external catalog provider; all catalog data goes through the application's own API and model. |
| NFR-7 | Raw technical errors never shown to users. |
| NFR-8 | Simulated data (reviews, payment, inventory automation) is identified as simulated in the product. |

## 6. Product rules (from the brief)

- Guests can browse, search, filter, sort, view products and reviews, use the cart and wishlist, and keep recently viewed and search history.
- Authentication is required for checkout and order placement, not before.
- Guest cart, wishlist, recently viewed and search history are merged into the account on sign-in.
- Inventory is application-owned. Catalog data and inventory are kept separate.
- Behavioural messaging ("You've been checking this out") is never presented as inventory signal ("Only 3 left"). Scarcity messaging only reflects real application inventory.
- Payment failure preserves the cart and allows retry.
- Order lifecycle: Pending Payment → Payment Successful → Order Confirmed → Processing → Shipped → Out for Delivery → Delivered, with cancellation, return and refund where appropriate.
- AI is never used for cart calculations, inventory, payment, order state, authorization or validation.

## 7. Out of scope (MVP)

Real payment gateways, real notifications (email/SMS/push), multi-vendor marketplace, seller tools, full admin dashboard, production deployment, CI/CD, observability stack. See `backlog.md` for deferred ideas.

## 8. Success measures

The analytics event set and funnels in brief §20 (Search → Product → Cart → Checkout → Payment → Purchase, abandonment, AOV, repeat purchase) are captured locally so the funnel can be demonstrated.

## 9. Open questions

Tracked in `requirements/open-questions.md`. Q1–Q3 resolved 2026-10-06 (Express API, ₹ pricing — corrected from 1:1 to ₹96 = $1 on 2026-10-06 — all categories). All later questions are resolved too.
