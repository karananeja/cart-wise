# Technical Design — F-007 Address management

**Status:** Implementation
**Inputs:** specification.md (approved), ADR-004, F-006 (sessions, owner checks)

## 1. Shared (`packages/shared/src/address.ts`)

- `INDIAN_STATES` (36 states and union territories).
- `checkAddress(input)` → `{ errors, values }`. Used by both the form and the API.
- `AddressInput`, `Address`, `GeoPlace` types.
- `PublicUser` gains `mobile`: the owner's own number, used to pre-fill the form. The UI still shows it masked.

## 2. API

- **Table:**
  ```sql
  addresses(id PK, user_id FK CASCADE, full_name, mobile, pincode, line1, line2, landmark, city, state,
            type CHECK IN (home, work, other), latitude NULL, longitude NULL, is_default, created_at, updated_at)
  ```
- **`addresses/service.ts`** (all queries scoped by `user_id`):
  - `list`: default first, then newest.
  - `create`: the first address becomes default; refuses at 10; an optional `makeDefault` lets Undo restore a deleted default.
  - `update`.
  - `remove`: if the default is removed, promotes the newest remaining and returns `promotedId`.
  - `setDefault`.

  Every change of default happens in one transaction, so exactly one default exists.
- **`geo/service.ts`:** `createGeoService({ fetch, clock })`.
  - Calls Nominatim with a User-Agent and `countrycodes=in`.
  - Caches up to 500 entries for 24 hours.
  - Allows one upstream request per second (otherwise `GEO_UNAVAILABLE`, retryable).
  - Times out after 5 seconds.
  - Maps Nominatim address parts to `GeoPlace`.
- **Injectable fetch:** `createApp(db, { fetch })`. Tests pass a fake; production uses the global `fetch`.

## 3. Web (`apps/web/src/features/addresses/`)

- **Data hooks:** `useAddresses` and mutations (create, update, remove, set default) that write the returned list into the cache.
- **Pages:**
  - `AddressesPage` (`/account/addresses`): cards, Set as default, Edit, Delete with `UndoToast` (extracted from the cart into a shared component).
  - `AddressEditorPage` (`/account/addresses/new` and `/:id/edit`): step 1 is the `LocationPicker`, step 2 is the `AddressForm`. Edit starts at the form.
- **LocationPicker:**
  - `LocationSearch`: a combobox-style suggestions list, current location, and the resolved-address line. Plain React, fully testable.
  - `MapView`: `react-leaflet` with OSM tiles and a draggable `divIcon` pin, so there are no bundler image paths. Loaded with `React.lazy`, so Leaflet and its CSS are a separate chunk only fetched on these screens.
  - Component tests mock `MapView`.
- **Links:** My account and the header account menu link to Addresses.
