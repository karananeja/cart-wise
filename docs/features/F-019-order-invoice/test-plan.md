# Test Plan — F-019 Order invoice (PDF)

| Level | File | Covers |
|---|---|---|
| Unit | `packages/shared/src/gst.test.ts` | Rate table and defaults; ₹2,500 vs ₹2,500.01 threshold for every apparel/footwear category; inclusive split and rounding; CGST/SGST odd paisa vs IGST; reconciliation across rates and amounts; Karnataka check; invoice number; amount in words (lakh, crore, paise) |
| API | `apps/api/src/orders/invoice.test.ts` | 401 / 404 (missing, other customer) / 409 (pending, expired); 200 headers, `%PDF-`, size; still available after cancellation. Invoice data: mixed-category Karnataka order with a bank offer (rates per AC 3, CGST+SGST, totals, words, paid amount); Maharashtra order with IGST and an 18% delivery line; No Cost EMI plan and discount; Razorpay offer label and default rate; cancelled-after-payment banner and refund with the sale unchanged; return refund listed; multi-page PDF |
| Component | `apps/web/src/features/orders/Orders.test.tsx` "invoice download" | Button on paid and cancelled orders and on the confirmation page, saving `Cartwise-Invoice-<id>.pdf`; none for an unpaid order; error message and retry; disabled offline |
| E2E | `e2e/orders.spec.ts` "download the invoice" | Pay, open the order, download: file name, `%PDF-`, > 5 KB |
| Manual | Sample PDFs rendered to PNG | Layout, ₹ glyphs, CGST/SGST and IGST tables, cancelled banner and refunds, multi-page continuation; button at 1280 px and 360 px |
