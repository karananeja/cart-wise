# Project Plan

**Last updated:** 2026-10-06 (Phase 1 complete; MVP wrap-up)

## Phase 0 — Discovery (complete)

- [x] Inspect repository (greenfield: brief, CLAUDE.md, one template; no code; not a Git repo)
- [x] Establish documentation structure
- [x] Draft PRD, requirements catalogue, open questions
- [x] Propose ADR-001 (architecture) and ADR-002 (catalog/inventory)
- [x] Draft F-001 specification and intent
- [x] User decisions Q1–Q3 (2026-10-06)
- [x] User approval of F-001 (Gate 1, 2026-10-06)

## Phase 1 — MVP

Order follows the brief's journey and dependencies: each feature builds on the one before, and the guest experience is complete before authentication is introduced.


| #     | Feature                                                                           | Requirements                                               | Depends on   | Status                             |
| ----- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------ | ---------------------------------- |
| F-001 | Catalog browsing (foundation, home, categories, listing, filter, sort)            | DISC-1..5, INV-1, INV-3, STATE-1, ANL-1 (`filter_applied`) | —            | **Complete** (accepted 2026-10-06) |
| F-002 | Search + search history                                                           | SRCH-1..4, HIST-1                                          | F-001        | **Complete** (accepted 2026-10-06) |
| F-003 | Product details, sizes, reviews + recently viewed                                 | PDP-1, PDP-3, RV-1                                         | F-001        | **Complete** (accepted 2026-10-06) |
| F-004 | Guest cart (incl. Add to cart on the product page, PDP-2)                         | CART-1..4, PDP-2                                           | F-003        | **Complete** (accepted 2026-10-06) |
| F-005 | Wishlist                                                                          | WISH-1..2                                                  | F-003        | **Complete** (accepted 2026-10-06) |
| F-006 | Authentication + guest state merge                                                | AUTH-1..4                                                  | F-004, F-005 | **Complete** (accepted 2026-10-06) |
| F-007 | Address management (map-assisted)                                                 | ADDR-1..2                                                  | F-006        | **Complete** (accepted 2026-10-06) |
| F-008 | Checkout (address, delivery, summary, reservation)                                | CHK-1..3, INV-2                                            | F-007        | **Complete** (accepted 2026-10-06) |
| F-009 | Simulated payment (card, UPI, card offers)                                        | PAY-1..6                                                   | F-008        | **Complete** (accepted 2026-10-06) |
| F-010 | Orders (history, details, cancel/return/refund, delivery OTP) + order simulation  | ORD-2..5, SIM-3..4                                         | F-009        | **Complete** (accepted 2026-10-06) |
| F-011 | Store Simulation Console — inventory simulation (order simulation moved to F-010) | SIM-1..2                                                   | F-010        | **Complete** (accepted 2026-10-06) |


Loading / empty / error / offline states (STATE-1) and analytics events (ANL-1) are delivered inside each feature, not as separate features.

**Phase 1 feature list complete (F-001–F-011 accepted 2026-10-06).**

## Phase 2 — Next (brief §24)


| #     | Feature                                                                                                | Brief §24 items | Depends on          | Status                                            |
| ----- | ------------------------------------------------------------------------------------------------------ | --------------- | ------------------- | ------------------------------------------------- |
| F-012 | Product discovery: related products, frequently bought together, continue shopping, discovery homepage | 14, 15, 16, 20  | F-003, F-004, F-010 | **Complete** (accepted 2026-10-06)                |
| F-013 | Electronics variants: storage (phones, tablets), RAM + storage (laptops), per-option price and stock   | PDP-3, brief §6 | F-003–F-012         | Accepted 2026-10-07 |
| F-014 | EMI (normal + no-cost) and Razorpay payments in test mode | PAY-1..6, ORD-2..4 | F-009, F-010, F-013 | Accepted 2026-10-07 |
| F-015 | Pincode delivery check on the product page; zone rules enforced at checkout | User request 2026-10-07 | F-003, F-007, F-008 | Implemented and tested — awaiting Gate 2 |
| F-016 | Email OTP replaces mobile OTP (SMTP, demo fallback); ADR-006 | User request 2026-10-07 | F-006 | Approved (Gate 1, 2026-10-07) |
| F-017 | Account overview hub | User request 2026-10-07 | F-005, F-006, F-007, F-010 | Approved (Gate 1, 2026-10-07) |
| F-018 | Site footer: links, help pages, newsletter, decorative social/app badges | User request 2026-10-07 | F-016 (welcome email only) | Approved (Gate 1, 2026-10-07) |


Reviews, related products, frequently bought together, continue shopping, order tracking timeline, notifications, price-drop / back-in-stock, improved discovery homepage. To be sequenced after MVP acceptance.

## Phase 3 — Optional / experimental AI

Semantic search, Help me find, personalised recommendations, comparison, conversational shopping. Each requires a separate proposal per CLAUDE.md §14 and user approval.