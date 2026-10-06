# Project Conversation Log

User decisions, approvals and material clarifications. Not a transcript.

| Date | Topic | Decision / Outcome | Notes |
|---|---|---|---|
| 2026-10-06 | Kickoff | User asked to perform CLAUDE.md First Action: inspect, analyse requirements, establish documentation, prepare F-001 spec and intent; no implementation until explicit approval | |
| 2026-10-06 | Discovery output | Docs established; Q1–Q3 raised as blocking; F-001 spec/intent presented for Gate 1 | Awaiting user response |
| 2026-10-06 | Q1 Architecture | React + Tailwind + shadcn/ui, Node.js Express API, pnpm workspace | Express replaces proposed Fastify |
| 2026-10-06 | Q2 Currency | Show ₹ at 1:1 with USD for now | Configurable constant |
| 2026-10-06 | Q3 Categories | Show all 24 categories | Includes vehicle, motorcycle |
| 2026-10-06 | F-001 Gate 1 | **Approved** for implementation | |
| 2026-10-06 | F-001 implementation | Implemented, tested, presented for Gate 2 | Store name "Cartwise" is a placeholder pending user choice |
| 2026-10-06 | F-001 Gate 2 | **Accepted** ("proceed") | |
| 2026-10-06 | Store name | No answer; "Cartwise" kept as placeholder | Easy to change: `apps/web/src/app/store.ts` |
| 2026-10-06 | F-002 | Spec and intent presented for Gate 1 | |
| 2026-10-06 | F-002 Gate 1 | **Approved** | |
| 2026-10-06 | F-002 implementation | Implemented, tested, presented for Gate 2 | |
| 2026-10-06 | F-002 Gate 2 | **Accepted** | |
| 2026-10-06 | Q4 Variants | Add app-owned sizes for apparel and footwear | |
| 2026-10-06 | Q5 Reviews | Do not show DummyJSON reviews | |
| 2026-10-06 | F-003 | Spec and intent presented for Gate 1 | |
| 2026-10-06 | Q5 correction | Show DummyJSON reviews, unlabelled (earlier entry misread the answer) | |
| 2026-10-06 | Q15 Rating | Star rating = average of reviews | |
| 2026-10-06 | F-003 Gate 1 | **Approved**, size sets as proposed | |
| 2026-10-06 | F-003 implementation | Implemented, tested, presented for Gate 2 | |
| 2026-10-06 | F-003 Gate 2 | **Accepted** | |
| 2026-10-06 | F-004 | Spec and intent presented for Gate 1 | |
| 2026-10-06 | F-004 Gate 1 | **Approved** as proposed | |
| 2026-10-06 | F-004 implementation | Implemented, tested, presented for Gate 2 | |
| 2026-10-06 | F-004 Gate 2 review | Change: in-place +/− quantity after Add to cart, separate Go to cart | |
| 2026-10-06 | Delivery OTP | New requirement ORD-5/SIM-4: OTP required before a simulated delivery completes | Detailed in F-010/F-011 (Q16) |
| 2026-10-06 | Dev environment | User runs `pnpm dev` on 5173/3001; agent must use other ports and never kill it | |
| 2026-10-06 | F-004 Gate 2 | **Accepted** | |
| 2026-10-06 | F-005 | Spec and intent presented for Gate 1 | |
| 2026-10-06 | F-005 Gate 1 | **Approved** as proposed | |
| 2026-10-06 | F-005 implementation | Implemented, tested, presented for Gate 2 | |
| 2026-10-06 | F-005 Gate 2 | **Accepted** | |
| 2026-10-06 | F-006 decisions | Simulated mobile OTP verification; mobile+OTP sign-in; larger-quantity cart merge; forgot password with code | |
| 2026-10-06 | F-006 | Spec, intent and ADR-003 presented for Gate 1 | |
| 2026-10-06 | F-006 Gate 1 | **Approved**; ADR-003 accepted | |
| 2026-10-06 | F-006 implementation | Implemented, tested, presented for Gate 2 | |
| 2026-10-06 | Currency (Q2 correction) | ₹96 = $1; re-priced in place | Implemented immediately |
| 2026-10-06 | Card offers | New requirement PAY-5: best-card-offer banner on product page; offers apply at payment | Timing and offer rules: Q17 |
| 2026-10-06 | UPI | New requirement PAY-6: simulated UPI payment flow | F-009 |
| 2026-10-06 | Card offers (Q17) | Fictional banks; built with payment (F-009) | |
| 2026-10-06 | F-006 Gate 2 | **Accepted** | |
| 2026-10-06 | Q7 Map provider | OpenStreetMap | |
| 2026-10-06 | F-007 | Spec, intent and ADR-004 presented for Gate 1 | |
| 2026-10-06 | F-007 Gate 1 | **Approved**; ADR-004 accepted | |
| 2026-10-06 | F-007 implementation | Implemented, tested (incl. live OSM check), presented for Gate 2 | |
| 2026-10-06 | F-007 Gate 2 | **Accepted** | |
| 2026-10-06 | F-008 decisions | Delivery Standard/Express; hold at payment 10 min; inclusive taxes; checkout and payment as two features | |
| 2026-10-06 | F-008 | Spec and intent presented for Gate 1 | |
| 2026-10-06 | F-008 Gate 1 | **Approved** | |
| 2026-10-06 | F-008 implementation | Implemented, tested, presented for Gate 2 | |
| 2026-10-06 | F-008 Gate 2 | **Accepted** | |
| 2026-10-06 | F-009 | Spec and intent presented for Gate 1 | Decisions: offers, demo cards only, bank OTP, UPI flow |
| 2026-10-06 | F-009 decisions | Customer chooses offer; any valid card number (only first 6/last 4 sent); bank OTP step; in-page demo UPI app | |
| 2026-10-06 | F-009 Gate 1 | **Approved** | |
| 2026-10-06 | F-009 implementation | Implemented, tested, presented for Gate 2 | |
| 2026-10-06 | F-009 Gate 2 | **Accepted** | |
| 2026-10-06 | F-010 decisions | Q9: cancel before Shipped; 7-day item returns; staged refunds to original method. Q16: 4-digit delivery code, 3 tries | |
| 2026-10-06 | F-010 | Spec and intent presented for Gate 1 | Decisions: order simulation in F-010, operator access, delivery charge on returns |
| 2026-10-06 | F-010 decisions | Q6: console in MVP, order simulation in F-010; Q14: demo operator password; delivery charge not refunded on returns | |
| 2026-10-06 | F-010 Gate 1 | **Approved** | |
| 2026-10-06 | F-010 implementation | Implemented, tested, presented for Gate 2 | |
| 2026-10-06 | F-010 Gate 2 review | Return dialog width issue reported and fixed | |
| 2026-10-06 | F-010 Gate 2 | **Accepted** | |
| 2026-10-06 | F-011 decisions | Auto decrease 1–3 units; restock to seeded level; settings off by default, persisted; one console with tabs and log | |
| 2026-10-06 | F-011 | Spec and intent presented for Gate 1 | |
| 2026-10-06 | F-011 Gate 1 | **Approved** | |
| 2026-10-06 | F-011 implementation | Implemented, tested, presented for Gate 2 | |
| 2026-10-06 | F-011 Gate 2 | **Accepted** — Phase 1 MVP feature list complete | |
| 2026-10-06 | Next step after Phase 1 | MVP wrap-up first: journey/requirements audit, backlog triage, payment E2E flake investigation, bundle code-splitting | User choice |
| 2026-10-06 | MVP wrap-up | Audit done; history-removal, error/offline-state and event fixes; stale docs corrected; code-splitting; backlog triaged (`docs/mvp-wrap-up.md`) | Decisions pending: analytics identity, demo-notice copy, Phase 2 order |
| 2026-10-06 | MVP wrap-up decisions | Analytics: add account id and product ids to server events (differs from recommendation); demo notice mentions simulated stock; Phase 2 starts with product discovery | |
| 2026-10-06 | F-012 decisions | Honest pairing labels with ≥2-order threshold; one-tap bundle add for unsized items; home continue-shopping sections; cart pairing rail | |
| 2026-10-06 | F-012 | Spec and intent presented for Gate 1 | Confirm complementary category map |
| 2026-10-06 | F-012 Gate 1 | **Approved** (category map as drafted) | |
| 2026-10-06 | F-012 implementation | Implemented, tested, presented for Gate 2 | |
| 2026-10-06 | F-012 Gate 2 review | Personalised rails moved below the category grid and recently viewed | |
| 2026-10-06 | F-012 Gate 2 review | Homepage reordered per user; SQLite transaction-lock fix for intermittent failures | |
| 2026-10-06 | Account menu | User: profile dropdown cut off the email → fixed (menu sized to content, long emails wrap) | |
| 2026-10-06 | Electronics variants | Storage (phones/tablets) and RAM+storage (laptops); price steps up per tier; no colour; accessories/watches unchanged; build as F-013 after F-012 | User choice |
| 2026-10-06 | F-012 Gate 2 | **Accepted** | Companion price cap not chosen; kept in backlog |
| 2026-10-06 | F-013 | Spec and intent presented for Gate 1 | Decisions: tiers and price steps, preselection, card price |
