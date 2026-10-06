# Conversation Log — F-014 EMI and Razorpay

| Date | Topic | Decision / Outcome | Notes |
|---|---|---|---|
| 2026-10-06 | Request | EMI (normal + no-cost) and Razorpay with keys from env | User |
| 2026-10-06 | Direction | Test keys only; Razorpay and demo payment both offered; EMI simulated in demo mode and via Razorpay in Razorpay mode | User choice |
| 2026-10-06 | Spec + intent + ADR-005 drafted | Presented for Gate 1 | D1 EMI terms, D2 offer stacking, D3 Razorpay refunds |
| 2026-10-06 | Gate 1 | **Approved**: D1 as proposed; D2 normal EMI + bank offer, no-cost excludes; D3 Razorpay refunds; ADR-005 accepted | |
| 2026-10-06 | Design correction | No-cost EMI example fixed: the discount makes instalments sum to the price (₹60,000/6 mo → 6 × ₹10,000, ₹2,376 off), as FR-3's rule requires; the Gate 1 example was wrong | To be pointed out at Gate 2 |
