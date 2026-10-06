# Feature Specification

## Feature

**ID:** F-007
**Name:** Address management (map-assisted)
**Status:** Approved — In Progress (Gate 1 approved 2026-10-06)
**Requirements:** ADDR-1, ADDR-2, STATE-1, ANL-1 (`address_added`)
**User decision applied:** Q7 — OpenStreetMap map (Leaflet, Nominatim search), with a manual form always available (2026-10-06).

---

## 1. Objective

Let signed-in customers keep several delivery addresses with one default, added quickly by finding a place on a map and then refining the details. Checkout (F-008) picks from these addresses.

## 2. User Problem

Typing a full Indian address on a phone is slow and error-prone: wrong pincodes, missing localities, ambiguous landmarks. Customers also ship to more than one place (home, work, family) and don't want to retype addresses.

## 3. User Intent

"Save where I want things delivered, with as little typing as possible, and let me pick one quickly later."

## 4. User Stories

- As a customer, I want to find my location by searching or tapping a map, so most of the address fills itself in.
- As a customer, I want to correct and complete the details (flat number, landmark) before saving.
- As a customer, I want to type the address manually if the map doesn't help.
- As a customer, I want several addresses, with one as my default.
- As a customer, I want to edit or delete addresses, and undo an accidental delete.

## 5. Functional Requirements

### 5.1 Where it lives

- FR-1 **My account → Addresses** (`/account/addresses`), available only when signed in. Guests are sent to sign-in with `returnTo`, using the F-006 behaviour.
- FR-2 The same add/edit flow is reused by checkout in F-008.

### 5.2 Address details

- FR-3 **Fields:**

  | Field | Rule | Notes |
  |---|---|---|
  | Full name | 2–60 characters | Pre-filled from the account |
  | Mobile | Indian 10-digit | Pre-filled from the account |
  | Pincode | 6 digits, not starting with 0 | |
  | Flat / house / building | Required, up to 100 characters | |
  | Area / street / locality | Required, up to 120 characters | |
  | Landmark | Optional, up to 80 characters | |
  | City | Required | |
  | State | Chosen from the 36 states and union territories | |
  | Type | Home, Work or Other | |
  | Map position | Latitude/longitude | Only when chosen on the map |

- FR-4 Fields are validated inline, and focus moves to the first error (same pattern as sign-up).
- FR-5 At most **10 addresses** per account. At the limit, Add address is replaced by "You can save up to 10 addresses — delete one to add another."

### 5.3 Add with the map (ADDR-2)

- FR-6 **Step 1, find the location:**
  - A map centred on India (or on the default address, if any), with a search box.
  - **Search:** from 3 characters, after a short pause; India only; up to 5 suggestions.
  - **Use my current location:** asks the browser for permission only when tapped.
  - **Fine-tuning:** tapping the map or dragging the pin moves the location.
  - The resolved address is shown under the map ("Near: Indiranagar, Bengaluru 560038").
  - **Confirm location** continues.
- FR-7 **Step 2, add the details:** the form opens pre-filled from the location (pincode, area, city, state) with a small map preview and **Change**. The customer must add the flat/house details and can correct anything.
- FR-8 **Skip the map:** "Enter address manually instead" is always visible in step 1 and opens an empty form.
- FR-9 **When the map can't help:** if the map or search can't load (offline, service busy, error), step 1 says so ("The map isn't available right now") and offers the manual form. Saving never depends on the map.
- FR-10 **Attribution:** map data shows "© OpenStreetMap contributors" as the licence requires.

### 5.4 Managing addresses (ADDR-1)

- FR-11 **The list:**
  - each address is shown as a card with name, type badge, the address lines, pincode and mobile (masked);
  - the default address comes first, marked **Default**; the rest are newest first.
- FR-12 Each card has **Edit**, **Delete**, and (for non-default addresses) **Set as default**.
- FR-13 **Default rules:**
  - the first address saved becomes the default automatically;
  - deleting the default makes the most recently added remaining address the default, with a notice saying so;
  - there is always exactly one default when any address exists.
- FR-14 **Delete** takes effect immediately, with **Undo** for a few seconds. Undo restores the address, including its default status.
- FR-15 **Empty state:** "No saved addresses yet", with **Add address** as the primary action.

### 5.5 Analytics

- FR-16 `address_added`: `{ addressType, method: 'map' | 'manual', isDefault }`. No address content or location is included.

## 6. Non-Functional Requirements

- **Privacy:**
  - addresses are visible only to their owner (every request is checked against the signed-in account);
  - location is requested only on an explicit tap;
  - the browser never calls the map-search service directly: searches go through our API, so the shopper's IP and search text are not shared with it;
  - analytics carry no address data.
- **Accessibility:**
  - every map feature has a non-map equivalent (search results are a keyboard-operable list, and the form is always available);
  - the map region is labelled;
  - form fields follow the F-006 accessible field pattern.
- **Performance:** the map code loads only when the add/edit flow opens, so it doesn't slow down other pages.
- **External service etiquette** (ADR-004):
  - search and reverse-lookup go through our API with an identifying User-Agent;
  - results are cached;
  - requests are limited to 1 per second overall;
  - searches are debounced.
- **Responsiveness:** the map is full width on phones (about 50% of viewport height in step 1). No horizontal scroll at 360 px.

## 7. UX Requirements

- Primary flow: search or tap → Confirm location → add flat number → Save. Manual entry is one tap away throughout.
- Pre-filled values are clearly editable; nothing from the map is locked.
- Deleting uses Undo rather than a confirmation dialog.
- Default status is always visible and easy to change.

## 8. UI Requirements

- **Screens:** Addresses list (`/account/addresses`), add/edit flow (`/account/addresses/new`, `/account/addresses/:id/edit`).
- **Components:** AddressCard, AddressForm, LocationPicker (map + search + current location; lazy-loaded), StateSelect, UndoToast (shared with the cart), EmptyAddresses.
- **States:**
  - list: loading, empty, populated, at limit, error, offline;
  - map: loading, ready, unavailable;
  - form: saving, field errors.

## 9. Data Requirements

| Entity | Fields | Owner |
|---|---|---|
| Address | id, userId, fullName, mobile, pincode, line1 (flat/house), line2 (area/street), landmark, city, state, type, latitude, longitude, isDefault, createdAt, updatedAt | Application; owner-only access |

Exactly one default per user is enforced in a transaction.

## 10. API Requirements

All routes require sign-in (`401 SIGNED_OUT`) and only ever touch the caller's own addresses.

| Endpoint | Purpose |
|---|---|
| `GET /api/addresses` | List (default first, then newest) |
| `POST /api/addresses` | Create (the first one becomes default); `409 ADDRESS_LIMIT` at 10 |
| `PUT /api/addresses/:id` | Update |
| `DELETE /api/addresses/:id` | Delete; reassigns the default if needed; returns the updated list and the new default id |
| `POST /api/addresses/:id/default` | Make this the default |
| `GET /api/geo/search?q=` | Location suggestions (India), through the API to Nominatim, cached and rate-limited |
| `GET /api/geo/reverse?lat=&lon=` | Address parts for a map position |

**Errors:** `400 VALIDATION` (with field errors), `404 ADDRESS_NOT_FOUND`, `409 ADDRESS_LIMIT`, `503 GEO_UNAVAILABLE`.

## 11. State Management

- Server state: `['addresses']` query; mutations write the returned list into the cache.
- Location picker: local state (position, search text, resolved address).
- Form: local state, pre-filled from the account and the picked location.

## 12. Loading States

- List: skeleton cards.
- Map: a neutral placeholder of the same size until the tiles load.
- Search: an inline spinner in the suggestions list.
- Saving: a spinner on the Save button.

## 13. Empty States

See FR-15. Search with no results: "No places found — try a nearby area or enter the address manually."

## 14. Error States

- Map or search unavailable: FR-9.
- Location permission denied: "Location access is off — search or tap the map instead."
- Save failure: an inline message with the form kept intact.
- Offline: the list is read-only with a notice; adding is disabled.

## 15. Security Considerations

- Ownership is checked on every address route.
- Input is validated and length-capped on the server.
- The geocoding proxy accepts only bounded queries, India only, and never forwards cookies.
- No address data in analytics or logs.

## 16. Analytics

`address_added` (FR-16).

## 17. Acceptance Criteria

1. A guest opening Addresses is sent to sign-in and returns afterwards.
2. Searching "Indiranagar Bengaluru" shows suggestions; choosing one moves the pin and shows the resolved address; Confirm location opens the form with pincode, area, city and state filled in.
3. Tapping the map or dragging the pin updates the resolved address.
4. "Use my current location" asks for permission only when tapped; if denied, a clear message appears and other options remain.
5. "Enter address manually instead" opens an empty form; saving works without the map.
6. If the map or search service fails, the manual form is offered and saving still works.
7. Field validation is inline (pincode, mobile, required fields, state from list); focus goes to the first error.
8. The first address becomes the default. Set as default switches it, and exactly one default exists at all times.
9. Deleting the default promotes the most recent remaining address and says so; Undo restores the deleted address and its default status.
10. An 11th address is refused with the limit message.
11. Customers can't see or change another account's addresses (API returns 404).
12. Map attribution is visible; the map code loads only on the add/edit screens.
13. `address_added` is stored with type, method and isDefault only.
14. Keyboard-only use works through search results and the form; no horizontal scroll at 360 px.

## 18. Testing Strategy

- **Unit:** address validation (pincode, mobile, states); default reassignment rules; mapping Nominatim responses to address parts; cache and rate limiter.
- **API:** CRUD with ownership, limit, defaults; geo proxy with Nominatim mocked (no network in tests), including the error and unavailable paths.
- **Component:** list states; form validation; picker with a mocked geo API (search → select → confirm → pre-filled form); fallback to manual; Undo delete.
- **E2E:** add a manual address, add via search (geo endpoints stubbed at the network layer in Playwright so tests don't depend on Nominatim), set default, delete with Undo, mobile layout.
- **Manual:** one real run against live OpenStreetMap/Nominatim on the preview ports.

## 19. Dependencies

- F-006 (accounts) — complete.
- ADR-004 (maps and geocoding) — proposed with this spec.
- New libraries: `leaflet` and `react-leaflet`.
- Network access to OpenStreetMap tiles and Nominatim when the map is used.

## 20. Out of Scope

- Delivery serviceability by pincode and delivery charges (F-008)
- Address autocomplete on the manual form
- Saving addresses for guests
- Google Maps
- Turn-by-turn or route display
- Sharing addresses
- Address verification beyond format checks

## 21. Assumptions

- India-only addresses (the ₹ store and Indian mobiles).
- OpenStreetMap's public tile server and Nominatim are acceptable for low-volume local demo use, within their usage policies (ADR-004).
- 10 addresses per account is enough.

## 22. Decisions Required From User

None outstanding. Confirmed 2026-10-06: 10 addresses; deleting the default promotes the newest remaining; signed-in only.
