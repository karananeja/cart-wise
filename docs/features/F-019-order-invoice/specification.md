# Feature Specification

## Feature

**ID:** F-019
**Name:** Order invoice (PDF)
**Status:** Complete (accepted 2026-10-07)

---

## 1. Objective

Let customers download a PDF tax invoice for any paid order. It shows a GST breakdown by category and is clearly marked as a demo document.

## 2. User Problem

Shoppers expect an invoice for what they bought, for records, warranty claims or expenses. Today there is no way to get one (F-010 left invoices out of scope).

## 3. User Intent

"Give me the invoice for this order."

## 4. User Stories

- As a customer, I can download the invoice from the order page or the confirmation page.
- As a customer who cancelled or returned items, the invoice still shows the original sale and lists the refunds.

## 5. Functional Requirements

**FR-1 Availability.**
- Any order that has been paid (Order confirmed onwards, including Cancelled-after-payment) has an invoice.
- Pending-payment and payment-expired orders have none.
- Only the order's owner can download it.

**FR-2 Where.**
- A **Download invoice** button on the order page (`/orders/:id`) and on the confirmation page.
- Clicking it saves `Cartwise-Invoice-<orderId>.pdf`.

**FR-3 Header.**
- Title "Tax Invoice (demo)", with "Not a valid tax document. Demo store." on every page.
- **Seller:** "Cartwise Demo Retail", a fictional Bengaluru, Karnataka address, and GSTIN shown as "DEMO — not registered" (not in a real GSTIN format, so it can't match a real business).
- **Invoice details:** invoice number `INV-<order id without "ORD-">`; invoice date = payment date; order id and order date.
- **Bill / ship to:** the delivery address saved on the order (name, address, pincode, state).

**FR-4 Lines.** For each item:
- description (title, plus size or option), quantity and unit price;
- the line amount (price × quantity, GST inclusive);
- the GST rate, taxable value and tax.

Delivery charge, when not free, is its own line at 18%.

**FR-5 GST rates.** These are simplified demo rates following the GST 2.0 slabs (effective 22 Sep 2025). They live in one shared table (`packages/shared/src/gst.ts`):

| Rate | Categories |
|---|---|
| 5% | groceries; apparel and footwear (mens-shirts, tops, womens-dresses, mens-shoes, womens-shoes) **when the unit price is ₹2,500 or less** |
| 18% | apparel and footwear above ₹2,500; beauty, fragrances, skin-care, furniture, home-decoration, kitchen-accessories, laptops, smartphones, tablets, mobile-accessories, sports-accessories, sunglasses, mens-watches, womens-watches, womens-bags; delivery charge |
| 3% | womens-jewellery |
| 40% | motorcycle, vehicle |

**FR-6 Tax split.**
- Prices include GST. For each line: taxable value = round(amount × 100 / (100 + rate)), and GST = amount − taxable value.
- **Same state as the seller (Karnataka):** CGST and SGST at half the rate each. The odd paisa goes to SGST.
- **Any other state:** IGST at the full rate.
- The totals of the taxable value, tax and line amounts add up exactly.

**FR-7 Totals and payment.**
- Shows: items total, delivery, invoice total (GST inclusive), and total tax, plus the amount in words ("Rupees … only").
- **Payment summary:** the method label (e.g. "Aurora Bank Visa •••• 4242", "Razorpay · UPI", EMI plan), then any payment-side discounts (bank offer, no-cost EMI discount, Razorpay offer) and the amount paid.
- A note that payment discounts don't change the tax on items. This is a demo simplification.

**FR-8 Refunds.**
- **Cancelled after payment:** a "Cancelled — refunded" banner.
- **Returns and cancellations:** a "Refunds" section listing each refund (date, reason or items, amount, status).
- The original lines and totals are never altered.

## 6. Non-Functional Requirements

- **Performance:** the PDF is generated on request (one page for typical orders, more if needed) in well under a second.
- **Fidelity:** ₹ and Indian digit grouping render correctly, using an embedded open-licence font. A4 page size.
- **Accessibility:** the button is a proper link with an accessible name. The PDF has a document title. A tagged PDF is out of scope.
- **Security:** owner check, the same as the order API. No card numbers beyond what the order already shows.

## 7. UX Requirements

- One secondary action, **Download invoice**, next to the order's other actions. It is not the primary action.
- A failure shows a short message with Try again.

## 8. UI Requirements

- `OrderPage` and `ConfirmationPage` get the button.
- **States:** idle, downloading (spinner on the button), error.

## 9. Data Requirements

- No new tables. Everything comes from the stored order: lines, address snapshot, delivery, totals, payment, refunds. Rates come from the product's category.
- **Invoice number and date** are derived from the order, so nothing new is stored.

## 10. API Requirements

`GET /api/orders/:id/invoice.pdf`:
- **Success:** `200 application/pdf`, with `Content-Disposition: attachment; filename="Cartwise-Invoice-<id>.pdf"`.
- **Errors:**
  - `401` signed out
  - `404` not yours or missing
  - `409 INVOICE_NOT_AVAILABLE` for unpaid orders

## 11. State Management

None beyond the download state of the button.

## 12. Loading States

Spinner on the button while the file downloads.

## 13. Empty States

N/A. The button is hidden when no invoice is available.

## 14. Error States

- "Couldn't download the invoice. Please try again."
- Offline: the button is disabled, with the existing offline banner.

## 15. Security Considerations

- Only the owner can download.
- The demo GSTIN and the labels prevent the document being mistaken for a real tax invoice.

## 16. Analytics

N/A. Downloading isn't a product signal we need.

## 17. Acceptance Criteria

1. A paid order's page and confirmation page offer **Download invoice**, which saves a PDF named `Cartwise-Invoice-<id>.pdf`.
2. The PDF shows the demo labels, the seller with "DEMO — not registered", the invoice number and date, and the bill-to address.
3. **Lines carry the rates from FR-5.** A ₹2,000 shirt is at 5% and a ₹3,000 one at 18%. A laptop is at 18%, groceries at 5%, a motorcycle at 40%. Delivery, when charged, is at 18%.
4. **A Karnataka address gets CGST + SGST; any other state gets IGST.** The sums of taxable value + tax equal the invoice total to the paisa.
5. **Payment-side discounts and the amount paid match the order page.** The amount in words matches the invoice total.
6. **Cancelled after payment:** the invoice shows "Cancelled — refunded" and the refund. After a return, the Refunds section lists it.
7. **Pending or expired orders have no button,** and the API returns 409. Another customer gets 404.
8. ₹ renders correctly.

## 18. Testing Strategy

- **Unit:** GST table and threshold, inclusive split and rounding, CGST/SGST vs IGST, totals reconcile, amount in words.
- **API:** owner, 401/404/409, headers, a PDF that starts with `%PDF`. Invoice content is asserted on the invoice data builder (the same data the PDF draws).
- **Component:** button visibility per status, download error message.
- **E2E:** pay, open the order and download. Check the filename, that it is a PDF, and that it is non-trivial in size.

## 19. Dependencies

F-009 payment, F-010 orders and refunds, F-014 payment labels and EMI. New dependency: `pdfkit` (MIT), plus an embedded OFL font for ₹.

## 20. Out of Scope

- Credit notes (refunds are noted on the invoice).
- HSN codes, e-invoicing/IRN and QR codes.
- Emailing the invoice (backlog, with order notification emails).
- Business GSTIN on the buyer side.
- Invoices for pending or expired orders.

## 21. Assumptions

- **Seller state is Karnataka,** for the CGST/SGST vs IGST choice.
- **The rates are simplified:** a category average under GST 2.0. Real rates depend on HSN codes and on details (e.g. engine size) that the catalog doesn't have.
- **Bank and Razorpay offers are treated as payment discounts** that don't reduce taxable value. This is a stated simplification.

## 22. Decisions Required From User

None. Resolved 2026-10-07: D1 rate table and seller state (Karnataka) approved.
