# Test Plan — F-015 Pincode delivery check

| Level | File | Covers |
|---|---|---|
| Unit | `packages/shared/src/serviceability.test.ts` | Pincode format; every zone incl. edges (682550/682551/682559/682560, 9xxxxx, 744, NCR) |
| Unit | `packages/shared/src/checkout.test.ts` | Dates per zone, no Express for remote, nothing for unserviceable, prices unchanged |
| API | `apps/api/src/orders/orders.test.ts` "delivery zones" | Metro quote; remote Standard-only with Express fallback and `EXPRESS_UNAVAILABLE`; unserviceable blocker, `422`, no stock held |
| Component | `apps/web/src/features/delivery/DeliveryCheck.test.tsx` | Metro/remote/unserviceable/invalid results, event without pincode, remembered + Change, default-address prefill |
| Component | `apps/web/src/features/checkout/Checkout.test.tsx` "delivery zones" | Remote Standard-only note; unserviceable message and disabled Continue |
| E2E | `e2e/delivery.spec.ts` | Guest check remembered across reload; remote checkout at 360 px; unserviceable address can't continue |
