# Backlog

Useful ideas that are outside the currently approved scope. Nothing here is implemented without user approval.

Triage (MVP wrap-up, 2026-10-06): **Phase 2** = fits the brief's next phase; **Later** = worthwhile, low urgency; **Drop?** = suggest closing.

| Date | Idea | Origin | Notes | Triage |
|---|---|---|---|---|
| 2026-10-06 | Analytics funnel view (simple local page computing brief §20 funnels from stored events) | Discovery | Events are stored from F-001; could live in the Simulation Console | Phase 2 (pairs with the analytics identity decision) |
| 2026-10-06 | Writing and moderating reviews (application-owned) | F-003 | Imported reviews shown since F-003; brief lists Reviews under "Next" | Phase 2 |
| 2026-10-06 | Self-hosted product images for fully offline demos | Discovery | Images are hotlinked from the DummyJSON CDN; offline or slow networks show placeholders | Later |
| 2026-10-06 | Catalog re-import / refresh command with diff | Discovery | Snapshot import is enough for MVP | Later |
| 2026-10-06 | Brand landing pages | F-001 scoping | Brand is already a filter | Later |
| 2026-10-06 | Product weight/dimensions in specifications | F-001 | Needs units; DummyJSON provides none | Drop? |
| 2026-10-06 | Automated accessibility checks (axe) in component/E2E tests | MVP wrap-up | Accessibility is built in but not machine-verified | Later |
| 2026-10-06 | Electronics variants: storage for phones and tablets, RAM + storage for laptops; price steps up per tier; no colour; accessories and watches unchanged | User feedback (F-012 Gate 2 review) | Built as F-013, accepted 2026-10-06 | Done |
| 2026-10-06 | Price cap for "Pairs well with" companions (e.g. companion ≤ 50% of the main product's price, falling back to the current rule) | F-012 acceptance (known limitation) | Product change; offered at F-012 Gate 2, user accepted F-012 without choosing | Later (awaiting user decision) |
| 2026-10-06 | EMI (normal and no-cost) and Razorpay payments | User request | Decided: Razorpay test keys only; Razorpay and demo payment both offered; EMI simulated in demo mode and via Razorpay in Razorpay mode. Built as F-014, accepted 2026-10-07 | Done |
| 2026-10-06 | Investigate a one-off E2E failure in the wishlist "move a sized product to the cart" test (1 of 9 runs during F-014) | F-014 testing | Passed alone and in 8 other full runs; trace not kept. Next time it fails, keep `test-results/` | Later |
| 2026-10-06 | Show Razorpay's EMI tenure on orders paid by Razorpay EMI | F-014 | Needs Razorpay's payment fields for EMI confirmed against their docs | Later |
| 2026-10-07 | MSG91 SMS OTP (widget or DLT template) | User request | Replaced by email OTP over SMTP (F-016, ADR-006); revisit if SMS is wanted later | Dropped for now |
| 2026-10-07 | Pincode delivery check on cart, listing and wishlist pages | F-015 scoping | F-015 covers product page and checkout | Later |
| 2026-10-07 | Order notification emails (confirmed, shipped, delivered, refunded) using the F-016 mailer | F-016 scoping | Needs SMTP; not requested | Later |
| 2026-10-07 | Profile editing: name, password, email/mobile change | F-017 scoping | User chose overview hub only | Later |
