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
