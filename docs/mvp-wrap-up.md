# MVP Wrap-up — 2026-10-06

The user chose this after Phase 1 was accepted: check what was built against the brief, PRD, MVP requirements and CLAUDE.md, fix what falls short, and triage the backlog before Phase 2.

## 1. Requirements audit

Every MVP requirement ID (DISC, SRCH, HIST, PDP, RV, CART, WISH, AUTH, ADDR, CHK, PAY, ORD, INV, SIM, STATE, ANL, NFR) and the concrete CLAUDE.md rules (§11–§16) were checked against the code and tests.

**Met:** all requirements except those listed below.

**Deferred by decision:**
- related products, frequently bought together and recommendations (Phase 2);
- "Trending" (needs real behaviour data);
- notifications (Phase 2);
- natural-language search (Phase 3 / AI).

### Gaps found and what happened

| # | Gap | Requirement | Outcome |
|---|---|---|---|
| 1 | A signed-in user's removed search, or cleared recently viewed, came back on the next page load: removal changed only the device copy, and the account sync merged it back | HIST-1, RV-1 | **Fixed** (`e180f45`). New `POST /api/auth/history/remove`; removals are mirrored; sign-out resets the device without touching the account. Covered by API and component tests |
| 2 | Account, Your orders and the address editor treated a *failed* sign-in check as "signed out" and redirected a signed-in user to sign-in; editing an address whose fetch failed said "not found" | STATE-1 | **Fixed** (`854c1ba`). The shared `QueryFallback` shows the error state |
| 3 | Pages opened offline (account, orders, confirmation, payment, operator orders, product rails) showed a skeleton forever, because the requests were paused | STATE-1 | **Fixed** (`854c1ba`). Offline state shown; rails are left out. 7 new tests; each fails without the fix |
| 4 | Server payment and order events carried no `orderId`, so a payment couldn't be joined to its order | ANL-2 | **Fixed** (`6df5acf`) |
| 5 | Funnels by person (repeat purchase) and by product (Wishlist → Purchase) aren't computable: events are keyed by an anonymous browser id and `order_created` carries no product ids | ANL-2 | **Decided: add them** (user, 2026-10-06). Server events store the account id (new `user_id` column); `order_created` lists product ids |
| 6 | `recommendation_clicked` is never emitted, because there is no recommendation surface yet | ANL-1 | Arrives with the Phase 2 discovery work |
| 7 | The storefront demo notice doesn't say stock levels are simulated and can change automatically | NFR-8 | **Decided: mention stock** (user, 2026-10-06). The footer now says stock levels are simulated |
| 8 | Cancelling an *unpaid* hold records no `order_cancelled` | ANL-1 | Kept as is: unpaid holds aren't orders to the customer (F-010 FR-4). Recorded here |

**Stale docs corrected** (`6df5acf`): PRD status and the simulation-console row, the price rate (₹96 = $1), project state, plan header, ADR-001 decision note, the rating observation, CHK-3 wording.

## 2. Engineering clean-up

- **Route-level code-splitting** (`096345e`): non-browsing pages load on demand. The main bundle went from 829 kB to 407 kB (gzip 250 → 124 kB), and the Vite size warning is gone.
- **One-off payment E2E failure:** seen once during F-011 testing. It has not recurred in 21 full E2E runs since, before and after code-splitting. The cause wasn't identified, so it is recorded rather than called fixed.

## 3. Test status

- 408 unit, API and component tests (shared 38, API 215, web 155). The web suite is stable over 18 consecutive runs, after fixing three timing- and order-dependent tests.
- 46 E2E tests, stable over repeated runs.
- Typecheck and build clean.

## 4. Decisions applied

- **Analytics identity:** server events for orders and payments store the account id (new `user_id` column), and `order_created` lists its product ids. Client events keep the random per-browser id. Documented in the PRD and in the analytics client.
- **Demo notice:** the footer now says stock levels are simulated.
- **Phase 2:** product discovery first (F-012).

## 5. Backlog triage

See `backlog.md` (Triage column).
