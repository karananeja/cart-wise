# Feature Intent

**Feature:** F-019 — Order invoice (PDF)
**Status:** Awaiting Approval
**Approved by / date:** —

---

## 1. In one sentence

Every paid order has a **Download invoice** button that saves a PDF tax invoice with a GST breakdown by category. It is clearly marked as a demo.

## 2. Intended behavior

- **Order page and confirmation page:** **Download invoice** saves `Cartwise-Invoice-ORD-….pdf`.
- **The invoice:**
  - "Tax Invoice (demo)" from Cartwise Demo Retail, Bengaluru, with GSTIN "DEMO — not registered".
  - Invoice number and date, and your delivery address.
  - **Each item:** quantity, price, GST rate, taxable value and tax. Delivery is its own line when charged.
  - **Tax type:** CGST + SGST for Karnataka addresses, IGST for everywhere else.
  - **Totals:** total tax and the amount in words.
  - **Payment:** how you paid, any bank offer or no-cost EMI discount, and the amount paid.
- **Rates** (simplified, following GST 2.0):
  - groceries 5%;
  - clothes and shoes 5% up to ₹2,500 a piece, 18% above;
  - jewellery 3%;
  - motorcycles and cars 40%;
  - everything else 18%, including delivery.
- **Cancelled after payment:** the invoice says "Cancelled — refunded". Returns and other refunds are listed in a Refunds section, and the original sale isn't changed.
- **Unpaid or expired orders:** no invoice.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| Real PDF from the API | One click; same on every browser and phone |
| GST by category under the new slabs | Looks and reads like an Indian tax invoice |
| Loud demo labels and a non-real GSTIN | It must never pass as a real tax document |
| Refunds noted, no credit notes | One document per order; your choice |
| Secondary button, not primary | Most visits to an order page are about tracking |

## 4. What this feature deliberately does not do

- Credit notes.
- HSN codes, e-invoicing (IRN/QR).
- Emailing the invoice.
- A business GSTIN for the buyer.

## 5. How we will know it works

Acceptance criteria 1–8 in `specification.md` §17.

## 6. Decisions needed before implementation

D1: confirm the rate table and seller state (Karnataka).

## 7. Approval

- [ ] Approved for implementation (Gate 1)
