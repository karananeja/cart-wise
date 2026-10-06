# Test Plan

**Feature:** F-007 — Address management (map-assisted)

## 1. Scope

Address validation, CRUD with ownership, limit and default rules, the geocoding proxy (mapping, caching, pacing, failures, de-duplication), the location picker (search, tap, current location, fallbacks), the form, list management with Undo, analytics, lazy map loading, and mobile layout.

## 2. Risk areas

- Cross-account access
- Exactly-one-default invariant
- External service etiquette and failure handling
- Map code leaking into other pages' bundles

## 3. Tests

| Level | Area | File |
|---|---|---|
| Unit | address validation and state matching | `packages/shared/src/address.test.ts` |
| API | CRUD, sign-in required, defaults (first, switch, delete-promote, restore), limit, ownership | `apps/api/src/addresses/addresses.test.ts` |
| API/unit | Nominatim mapping, polite requests, cache, 1/s pacing (queue), queue limit, de-duplication, unavailable path | `apps/api/src/geo/geo.test.ts` |
| Component | guest redirect; search → confirm → pre-filled → save default + analytics; map tap; manual fallback with validation and focus; default switching, delete-promote, Undo; empty state | `apps/web/src/features/addresses/Addresses.test.tsx` (map stubbed) |
| E2E | search + map tap + save; manual address; set default; delete with Undo; map code not loaded elsewhere; mobile with attribution | `e2e/addresses.spec.ts` (tiles and geocoder stubbed at the network layer) |

## 4. Manual verification

Live run on the preview ports against real OpenStreetMap tiles and Nominatim: "Indiranagar Bengaluru" search, pin on the map, pre-filled form (Indiranagar, 560008, Bengaluru, Karnataka), saved as Default. No console errors.

## 5. Results

| Run date | Command | Result | Notes |
|---|---|---|---|
| 2026-10-06 | `pnpm test` | 272 passed (shared 20, api 154, web 98) | Address component tests stable over repeats |
| 2026-10-06 | `pnpm e2e --repeat-each=3 --workers=2` | 96 passed (32 × 3) | |
| 2026-10-06 | `pnpm typecheck`, `pnpm build` | Clean / succeeds | Leaflet in its own `MapView` chunk (153 kB JS, 15 kB CSS) |

### Defects found and fixed during testing

- **Geocoding pacing rejected bursts:** a search followed quickly by a pin drag would have failed. Requests now queue and are spaced one second apart, with a short queue limit (caught by an API route test).
- **Form focus:** after validation, focus went to the first error in validation order (pincode) instead of on-screen order (flat number).
- **Duplicate suggestions:** live Nominatim results contained duplicate places; suggestions are now de-duplicated by name and pincode (found in the live check).
- **Test-only:** a debounced search needed a longer wait; the suggestion-name matcher was tightened.
