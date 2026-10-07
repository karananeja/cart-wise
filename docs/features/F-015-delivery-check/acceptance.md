# Acceptance

**Feature:** F-015 — Pincode delivery check
**Status:** Pending user sign-off (Gate 2)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | 560038: Standard 2–3 days, Express 1–2 days with prices | Pass | Component; unit |
| 2 | 302001 Standard 3–5 / Express 2–3; 795001 Standard 6–9, "Express not available here" | Pass | Component (remembered 302001; 795001); unit |
| 3 | 744101 "We don't deliver to 744101 yet", Add to cart enabled | Pass | Component; E2E |
| 4 | "12345"/"012345" → "Enter a 6-digit pincode" | Pass | Component; unit |
| 5 | Checked pincode shown on next product page and after reload; Change replaces it | Pass | Component; E2E |
| 6 | Signed-in shopper sees their default address's pincode | Pass | Component |
| 7 | Remote address → Standard only; unserviceable → Continue disabled, API refuses | Pass | API; component; E2E |
| 8 | Product-page dates equal checkout dates | Pass | Same shared `deliveryOptions` on both sides; unit |
| 9 | Keyboard, screen reader, 360 px | Pass | Labelled input, Enter submits, polite live result; E2E 360 px (no horizontal scroll); screenshots |

## 2. Test results summary

- `pnpm test`: 523 passing (shared 70, API 263, web 190), 38 of them new.
- `pnpm e2e`: 58 passing, 2 of them new.
- Typecheck clean.

## 3. Known issues and limitations

- The zones are a documented simulation by pincode prefix. A well-formed pincode that doesn't exist is still treated by its prefix.
- The product page uses the device's date and checkout uses the server's. They match unless the device clock is wrong.

## 4. Deviations from the approved specification

- **Catalog "Shipping" text hidden on the product page:** the imported "Ships in 1 week" contradicted our dates. It still exists in the catalog data.
- **Address form hint:** the spec said the shopper is "told on save". The hint now appears as soon as an unserviceable pincode is typed, which is earlier.

## 5. Documentation updated

- [x] specification, intent, technical-design, test-plan, conversation-log
- [x] project-plan, project-state, conversation log

## 6. User sign-off (Gate 2)

- [ ] Accepted by user — date:
