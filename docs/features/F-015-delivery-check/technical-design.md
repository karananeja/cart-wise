# Technical Design — F-015 Pincode delivery check

- **Rules:** `packages/shared/src/serviceability.ts` holds `normalizePincode`, `deliveryZone` and `ZONE_DAYS`. `deliveryOptions(subtotal, now, zone)` in `checkout.ts` now takes the zone and returns only the options offered there (none when the pincode isn't served). Prices are unchanged.
- **API:** `orders/service.ts` `quote()` works out the zone from the chosen address's pincode, with regional dates before any address exists.
  - New blocker `NOT_SERVICEABLE`.
  - `expressUnavailable` flag, with `selectedDelivery` falling back to Standard.
  - `create()` refuses `422 NOT_SERVICEABLE`, or `400 EXPRESS_UNAVAILABLE` when Express is sent for an address without it.
  - Stored orders keep their delivery JSON.
- **Web:**
  - `lib/deliveryPincode.ts`: one remembered pincode (`store.deliveryPincode`), `useSyncExternalStore`, never throws.
  - `features/delivery/DeliveryCheck.tsx` sits in the product buy box. It computes the answer locally with the shared rules and uses `useAddresses` for the default pincode only when signed in with nothing saved.
  - Checkout: `chosenDelivery` follows `expressUnavailable`. Address summary and list mark unserviceable pincodes. The delivery section explains Standard-only or no delivery.
  - The address form hints when a pincode isn't served.
  - The catalog's "Shipping" specification is hidden on the product page, because it contradicted our dates.
- **Analytics:** `delivery_check_performed` `{zone, serviceable, expressAvailable, source}`. The pincode is never sent.
