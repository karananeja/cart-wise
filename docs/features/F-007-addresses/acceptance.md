# Acceptance

**Feature:** F-007 — Address management (map-assisted)
**Status:** Accepted (Gate 2, 2026-10-06)

## 1. Acceptance criteria verification

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Guests sent to sign-in and back | Pass | `Addresses.test.tsx`; API 401 |
| 2 | Search → suggestions → pin + resolved address → Confirm → pre-filled form | Pass | Component test; E2E; live check |
| 3 | Map tap or drag updates the resolved address | Pass | Component test (tap); E2E (tap on the real Leaflet map). Drag uses the same handler; checked by hand |
| 4 | Current location asks only on tap; denial explained | Pass | Implemented with the browser geolocation API; message on denial. Not automated (permission prompts) |
| 5 | Manual entry works without the map | Pass | Component test; E2E |
| 6 | Map/search failure → manual offered, saving works | Pass | Component test (search 503); map error boundary and tile-failure notice |
| 7 | Inline validation; focus to first error | Pass | Component test (on-screen order) |
| 8 | First is default; Set as default; exactly one default | Pass | API tests; component test; E2E |
| 9 | Deleting the default promotes the newest, with notice; Undo restores incl. default | Pass | API, component and E2E tests |
| 10 | 11th address refused | Pass | API test |
| 11 | No cross-account access | Pass | API test (404 for get/put/delete/default) |
| 12 | Attribution visible; map code only on the address screens | Pass | E2E (attribution; no Leaflet requests on product pages); build shows a separate chunk |
| 13 | `address_added` with type, method and isDefault only | Pass | Component test |
| 14 | Keyboard through search results and form; 360 px | Pass | Suggestions are buttons in a list; native form controls; E2E mobile |

## 2. Test results summary

272 unit/API/component tests; 32 E2E tests passing on 3 repeated runs; typecheck and build clean; one live check against OpenStreetMap.

## 3. Known issues and limitations

- **Approximate pincodes:** OpenStreetMap's Indian address data is uneven; pincodes can differ between nearby results (e.g. 560008 vs 560038 for Indiranagar). All fields stay editable.
- **Light use only:** public OSM tiles and Nominatim are for light use. Production would need its own provider (ADR-004).
- **Not automated:** "Use my current location" and pin dragging were checked by hand, not by automated tests.

## 4. Deviations from the approved specification

None.

## 5. Documentation updated

- [x] specification.md, intent.md, technical-design.md, test-plan.md; ADR-004 accepted
- [x] project-state.md, project-plan.md, conversation logs

## 6. User sign-off (Gate 2)

- [x] Accepted by user — date: 2026-10-06
