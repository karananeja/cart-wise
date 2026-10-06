# Feature Intent

**Feature:** F-014 — EMI (normal and no-cost) and Razorpay payments (test mode)
**Status:** Approved (Gate 1, 2026-10-06)
**Approved by / date:** User, 2026-10-06

---

## 1. In one sentence

Shoppers see the monthly EMI before deciding and can pay in instalments, with an honest no-cost option. At payment they can use the demo payment or Razorpay Checkout in test mode.

## 2. Intended behavior

- **Product page:** "EMI from ₹5,387/month · No Cost EMI available", with "View plans" for banks and tenures.
- **Demo payment:**
  - Enter a fictional credit card and choose Pay in full or Pay in EMI.
  - The plans show monthly amount, interest and total. No-cost plans give the interest back as a discount, so 6 × ₹9,588 is exactly the price.
  - Bank OTP as today. The order and confirmation show the plan.
- **Razorpay tab** (only when your test keys are set):
  - "Pay ₹X with Razorpay" opens Razorpay Checkout (card, UPI, netbanking, EMI).
  - The payment is verified on the server before the order is confirmed.
  - Cancellations and returns are refunded through Razorpay in test mode.
- **Never real money:** live keys are refused.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| EMI appears only for an eligible credit card | Progressive disclosure: no plan list to read through for UPI or debit cards |
| Monthly amount always shown with interest and total | Honest; avoids hiding the cost of credit |
| "No Cost" only when the instalments sum exactly to the price | No misleading labels |
| Razorpay as a third tab, not a replacement | Your choice; the demo payment keeps working without keys and in tests |
| Refunds go through Razorpay | The refund the customer sees is the one the gateway made |

## 4. What this feature deliberately does not do

- Live payments.
- Saved cards.
- Debit or cardless EMI in the demo payment.
- GST on interest.
- Subscriptions.

## 5. How we will know it works

Acceptance criteria 1–10 in `specification.md` §17, plus one manual test-mode payment and refund with your keys.

## 6. Decisions needed before implementation

Resolved 2026-10-06: D1 terms as proposed; D2 normal EMI + bank offer allowed, no-cost EMI excludes offers; D3 refunds through Razorpay.

## 7. Approval

- [x] Approved for implementation (Gate 1) — 2026-10-06
