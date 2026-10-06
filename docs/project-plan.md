# Project Plan

**Last updated:** 2026-10-06 (F-001 implemented)

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

| # | Feature | Requirements | Depends on | Status |
|---|---|---|---|---|
| F-001 | Catalog browsing (foundation, home, categories, listing, filter, sort) | DISC-1..5, INV-1, INV-3, STATE-1, ANL-1 (`filter_applied`) | — | **Complete** (accepted 2026-10-06) |
| F-002 | Search + search history | SRCH-1..4, HIST-1 | F-001 | Spec drafted — awaiting Gate 1 |
| F-003 | Product details + recently viewed | PDP-1..3, RV-1 | F-001 | Not started |
| F-004 | Guest cart | CART-1..4 | F-003 | Not started |
| F-005 | Wishlist | WISH-1..2 | F-003 | Not started |
| F-006 | Authentication + guest state merge | AUTH-1..4 | F-004, F-005 | Not started |
| F-007 | Address management | ADDR-1..2 | F-006 | Not started |
| F-008 | Checkout (address, delivery, summary, reservation) | CHK-1..3, INV-2 | F-007 | Not started |
| F-009 | Simulated payment | PAY-1..4 | F-008 | Not started |
| F-010 | Orders (history, details, cancel/return/refund) | ORD-1..4 | F-009 | Not started |
| F-011 | Store Simulation Console | SIM-1..3 | F-010 | Pending Q6 |

Loading / empty / error / offline states (STATE-1) and analytics events (ANL-1) are delivered inside each feature, not as separate features.

## Phase 2 — Next (brief §24)

Reviews, related products, frequently bought together, continue shopping, order tracking timeline, notifications, price-drop / back-in-stock, improved discovery homepage. To be sequenced after MVP acceptance.

## Phase 3 — Optional / experimental AI

Semantic search, Help me find, personalised recommendations, comparison, conversational shopping. Each requires a separate proposal per CLAUDE.md §14 and user approval.
