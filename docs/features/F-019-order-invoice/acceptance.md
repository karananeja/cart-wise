# Acceptance

**Feature:** F-019 — Order invoice (PDF)
**Status:** Accepted (Gate 2, 2026-10-07)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Download invoice on order and confirmation pages saves `Cartwise-Invoice-<id>.pdf` | Pass | Component; E2E (filename, starts with `%PDF`, > 5 KB); screenshots |
| 2 | Demo labels, seller "DEMO — not registered", invoice no/date, bill-to | Pass | Builder tests; sample PDFs |
| 3 | Rates per FR-5: ₹2,500 apparel/footwear threshold, laptops 18%, groceries 5%, motorcycle 40%, delivery 18% | Pass | Unit (incl. ₹2,500.00 vs ₹2,500.01); builder; samples (₹2,704 shirt 18%, ₹1,855 slipper 5%, motorcycle 40%) |
| 4 | Karnataka CGST + SGST, other states IGST; totals reconcile to the paisa | Pass | Unit; builder; samples checked by hand |
| 5 | Payment discounts and amount paid match the order; amount in words matches | Pass | Builder (bank offer, no-cost EMI, Razorpay offer); unit (lakh/crore words) |
| 6 | Cancelled after payment: banner and refund; returns listed | Pass | API (cancel, return); sample PDF |
| 7 | No invoice for pending/expired (409); other customer 404 | Pass | API; unpaid orders never show the order page (they go to payment) |
| 8 | ₹ renders | Pass | Embedded Noto Sans; samples |

## 2. Test results summary

- `pnpm test`: 604 passing (shared 87, API 296, web 221), 27 of them new.
- `pnpm e2e`: 63 passing, 1 of them new.
- Typecheck clean.

## 3. Known issues and limitations

- **GST rates are simplified** to one rate per category, following the GST 2.0 slabs. There are no HSN codes, and bank and Razorpay offers don't reduce taxable value. All of this is stated on the invoice.
- **The font files** (Noto Sans, SIL OFL 1.1, about 1.3 MB) are committed in `apps/api/assets/fonts/` with their licence, so PDFs work offline.

## 4. Deviations from the approved specification

- **Banner wording:** "Cancelled — refund in progress" until every refund has completed (e.g. a Razorpay refund still initiated), then "Cancelled — refunded".
- **Download control:** it's a button that fetches the file, so errors can be shown. Clicking it again retries, so there is no separate Try again button.
- **Bill-to omits the mobile number.**

## 5. Documentation updated

- [x] technical-design, test-plan, conversation-log

## 6. User sign-off (Gate 2)

- [x] Accepted by user — date: 2026-10-07 ("accept")
