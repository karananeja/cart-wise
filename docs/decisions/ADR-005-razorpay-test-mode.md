# ADR-005: Razorpay Payments in Test Mode Only

**Status:** Proposed (with F-014 Gate 1)
**Date:** 2026-10-06

## Decision

Integrate Razorpay Standard Checkout as an optional second payment provider beside the demo payment. Accept **test keys only**: a `rzp_live_` key disables Razorpay at startup. No real money is ever processed, and the CLAUDE.md rule "Payment is simulated. Never process real money" stays true.

## Context

- The user asked for Razorpay support (2026-10-06), with keys provided through the environment.
- CLAUDE.md §12 says never process real money and never store card data. Brief §20 treats real payment integration as production work.
- User decisions (2026-10-06):
  - test keys only;
  - the customer chooses between the demo payment and Razorpay;
  - EMI comes from Razorpay in Razorpay mode.
- Razorpay test mode simulates payments with test cards and UPI IDs, and no money is deducted. Webhooks need a publicly reachable URL, which a local app does not have.

## Options Considered

1. **Standard Checkout with the Orders API, server verification and capture, test keys only** (chosen):
   - card data never touches our server;
   - Razorpay's documented integration;
   - works locally without webhooks by verifying the signature and fetching the payment.
2. **Allow live keys:** this would process real money, contradicts the project rule, and needs production hardening (reconciliation, chargebacks, settlement). The user rejected it.
3. **Replace the demo payment:** the app and its E2E tests would need keys and network. The user chose both options instead.
4. **Server-to-server (S2S) or custom checkout:** this would put card data in our flow, which is a PCI burden for no benefit.

## Decision Details

- **Configuration:**
  - `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (both required);
  - `RAZORPAY_WEBHOOK_SECRET` and `RAZORPAY_NO_COST_EMI_OFFER_ID` (optional);
  - loaded from `apps/api/.env` with Node's `--env-file-if-exists`, git-ignored, and documented in `.env.example`.
- **Flow:**
  1. Create a Razorpay order for the server-computed total.
  2. Checkout runs in the browser.
  3. The server verifies `HMAC-SHA256(order_id|payment_id, key_secret)` in constant time.
  4. The server fetches the payment and captures it if it is only authorised, then cross-checks the order id and amount.
  5. The order is confirmed through the same idempotent completion as the demo payment.
- **Reconcile and webhooks:** a pending Razorpay attempt is reconciled when its page loads. The webhook (raw-body signature) is optional.
- **Late payment:** a payment captured after the stock hold expired is refunded automatically.
- **Refunds:** cancellations and returns call the Refunds API (D3). A failure leaves the refund initiated, with operator retry.
- **Isolation:**
  - All Razorpay HTTP goes through one small client using injected `fetch`. Tests and E2E use a fake; no test calls Razorpay.
  - The base URL can be overridden only when `NODE_ENV=test` or E2E sets it.

## Consequences

- The app gains its first secret-bearing external dependency. Startup validation and log redaction are required.
- Demo bank offers and demo EMI are demo-only. Razorpay offers (including no-cost EMI) are configured in your Razorpay Dashboard.
- A real test-mode payment cannot be fully automated. Acceptance includes a manual check with the user's keys.
- Moving to live payments later is a separate, production-hardening decision (backlog), not a config change. The live-key refusal would have to be removed deliberately.
