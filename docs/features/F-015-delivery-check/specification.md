# Feature Specification

## Feature

**ID:** F-015
**Name:** Pincode delivery check
**Status:** Approved (Gate 1, 2026-10-07)

---

## 1. Objective

Let shoppers check, on the product page, whether the store delivers to their pincode, when it would arrive and whether Express is available. Checkout follows the same rules.

## 2. User Problem

Today the product page says nothing about delivery to the shopper's location. Every address gets the same options and dates at checkout, so a shopper finds out about delivery only at the end, and every pincode is treated the same.

## 3. User Intent

"Before I decide, tell me whether you can deliver this to me and by when."

## 4. User Stories

- As a guest, I want to enter my pincode on a product page and see whether it can be delivered and the estimated date.
- As a signed-in shopper, I want my default address's pincode used without typing it.
- As a shopper, I want the pincode I checked remembered on other product pages.
- As a shopper, I want checkout to tell me clearly if an address can't be served, and which delivery speeds it gets.

## 5. Functional Requirements

**FR-1 Zones (simulated, documented).** The pincode's prefix decides the zone. All rules live in one shared module (`packages/shared/src/serviceability.ts`).

| Zone | Pincode prefixes | Standard | Express |
|---|---|---|---|
| Metro | 110 (Delhi), 120–122 and 201 (NCR), 400 (Mumbai), 411 (Pune), 380 (Ahmedabad), 500 (Hyderabad), 560 (Bengaluru), 600 (Chennai), 700 (Kolkata) | 2–3 days | 1–2 days |
| Regional | Any other valid pincode starting 1–8 that isn't Remote or Not serviceable | 3–5 days | 2–3 days |
| Remote | 18–19 (Jammu & Kashmir, Ladakh), 737 (Sikkim), 78–79 (North-East) | 6–9 days | Not available |
| Not serviceable | 744 (Andaman & Nicobar), 682551–682559 (Lakshadweep), 9xxxxx (Army/Field Post) | — | — |

- Prices don't change: Standard ₹49, free over ₹999; Express ₹149.
- Rules are identical for every product. There are no per-product exclusions.

**FR-2 Product page check.**
- A "Delivery" block in the buy box, below the Add to cart row, holds a pincode field and a **Check** button.
- **Result for a serviceable pincode:**
  - "Delivery to 560038": Standard "Arrives by Fri, 10 Oct" with its price ("Free over ₹999" note when relevant), and Express "Arrives by Thu, 9 Oct · ₹149" or "Express not available here".
  - An area name ("Metro" or "Remote") is never shown. Only dates and options.
- **Not serviceable:** "We don't deliver to 744101 yet." Add to cart stays enabled. The pincode doesn't block browsing or the cart.
- **Invalid format:** an inline message, "Enter a 6-digit pincode".
- The dates use the same calculation as checkout.

**FR-3 Remembered pincode.**
- The checked pincode is saved on the device (`store.deliveryPincode`) and shown already checked on other product pages, with a **Change** link.
- A signed-in shopper with no saved pincode gets their default address's pincode.
- A pincode typed by the shopper always wins over the default address.

**FR-4 Checkout enforces the zones.**
- Delivery options and estimates in the checkout quote come from the selected address's zone.
- Express isn't offered for Remote addresses. If Express was chosen and the address changes to Remote, Standard is selected and a note says why.
- A Not serviceable address shows "We don't deliver to this pincode yet" in the address section. Continue is disabled with the blocker `NOT_SERVICEABLE`, and order creation refuses it (`422 NOT_SERVICEABLE`).
- Saving an address with an unserviceable pincode is still allowed. It can be used later, and the shopper is told on save.

**FR-5 Existing orders** keep the estimate stored when they were placed.

## 6. Non-Functional Requirements

- **Performance:** the check is computed locally from the shared rules, so there's no network round trip. The API uses the same function.
- **Accessibility:** a labelled input with `inputMode="numeric"`. The result sits in an `aria-live="polite"` region. Enter submits.
- **Responsive:** the field and button fit 360 px.
- **Maintainability:** one rules table, unit-tested at the edges.

## 7. UX Requirements

- One primary action: **Check**. Once a pincode is saved, the result shows directly with **Change**.
- The block is collapsed to a single line until it is used.
- Clear statements of date and availability, with no zone jargon.

## 8. UI Requirements

- `DeliveryCheck` component on the product page.
- Checkout `AddressSection` gains a not-serviceable state. `DeliverySection` gains an unavailable Express state.
- States: empty (prompt), checking (instant), result, not serviceable, invalid.

## 9. Data Requirements

- No new tables.
- Pincode on the device: one string under `store.deliveryPincode`.
- The rules are code constants.

## 10. API Requirements

- No new endpoint.
- `GET /checkout` quote: `delivery` is filtered by the address zone. `blockers` may include `NOT_SERVICEABLE`.
- `POST /orders`: `422 NOT_SERVICEABLE`, or `400` "Express isn't available for this address" if Express was sent for a Remote address.

## 11. State Management

- Pincode: device storage through a small hook.
- Default-address pincode: the existing `useAddresses` query, only when signed in.

## 12. Loading States

The check result is immediate. Prefill from the default address waits for the addresses query and shows the empty prompt until then (no layout jump: the line reserves its height).

## 13. Empty States

No pincode: "Check delivery to your pincode" with the field.

## 14. Error States

- Invalid format: an inline message.
- Address query failure: falls back to the empty prompt silently. The check itself can't fail.

## 15. Security Considerations

- The pincode is personal-ish data. It is kept on the device only and isn't sent with analytics; only the zone is.

## 16. Analytics

- New event `delivery_check_performed` with `{ zone, serviceable, expressAvailable, source: 'typed' | 'saved' | 'default_address' }`.
- It's recorded only when the shopper checks a pincode (typed), not on every page view.

## 17. Acceptance Criteria

1. Given pincode 560038 on a product page, Check shows Standard 2–3 days and Express 1–2 days with prices.
2. 302001 (regional) shows Standard 3–5 days and Express 2–3 days. 795001 (remote) shows Standard 6–9 days and "Express not available here".
3. 744101 shows "We don't deliver to 744101 yet". Add to cart still works.
4. "12345" or "012345" shows "Enter a 6-digit pincode".
5. A checked pincode is shown on the next product page and survives a reload. Change lets the shopper replace it.
6. A signed-in shopper with a default address and no saved pincode sees that pincode checked.
7. At checkout, a remote address offers only Standard with the remote dates. An unserviceable address disables Continue with the message, and the API refuses the order.
8. Dates on the product page equal those at checkout for the same pincode and day.
9. Keyboard and screen-reader usable. 360 px fits.

## 18. Testing Strategy

- **Unit:** the rules table (prefix edges such as 682550 vs 682551, 9xxxxx, invalid input) and dates per zone.
- **API:** the checkout quote per zone, `NOT_SERVICEABLE` blocker, order refusal and the Express refusal.
- **Component:** DeliveryCheck (typed, saved, default address, invalid, unserviceable), and the checkout not-serviceable state.
- **E2E:** check a pincode on the product page, then check out to a remote address with Standard only.

## 19. Dependencies

F-003 product page, F-007 addresses, F-008 checkout.

## 20. Out of Scope

- A real pincode directory (unknown but well-formed pincodes are treated by prefix).
- Town names.
- Cash on delivery.
- Per-product restrictions.
- Showing the check on cart, listing or wishlist pages (backlog).

## 21. Assumptions

- The zone rules are a simulation and are documented as such. Prefixes approximate real postal regions.
- Regional zone Express at 2–3 days (instead of today's 1–2 days everywhere) is part of the zone choice the user made.

## 22. Decisions Required From User

D1 — confirm the zone table in FR-1 (prefixes, days, Express availability).
