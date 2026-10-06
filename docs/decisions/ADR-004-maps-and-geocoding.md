# ADR-004: Maps and Geocoding

**Status:** Proposed (with F-007, 2026-10-06)
**Date:** 2026-10-06

## Decision

Show maps with Leaflet and OpenStreetMap tiles. Do place search and reverse lookup with Nominatim, called **only through our API**, which caches and rate-limits it. A manual address form is always available, so saving an address never depends on these services.

## Context

- Brief §11: map-assisted address flow (search → map position → confirm → refine manually); users should not need to understand coordinates.
- User decision Q7 (2026-10-06): OpenStreetMap.
- NFR-1: no paid services or API keys for the MVP.
- The OpenStreetMap tile and Nominatim usage policies require attribution, an identifying User-Agent, at most about 1 request per second, caching, and no heavy or bulk use.

## Options Considered

1. **Leaflet + OSM tiles + Nominatim through our API** (chosen):
   - free and keyless;
   - the proxy keeps the shopper's IP and search text away from third parties and lets us cache and rate-limit.
2. **Browser calls Nominatim directly:** simpler, but every shopper's IP and query go to a third party, and rate-limiting across shoppers is impossible.
3. **Google Maps Platform:** better Indian search coverage, but needs an API key with billing (conflicts with NFR-1), and it was not chosen by the user.
4. **MapLibre with vector tiles:** prettier, but needs a tile provider (usually keyed) and more setup for no MVP benefit.

## Decision

- **Tiles:** `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with "© OpenStreetMap contributors" attribution. The map loads only on the address add/edit screens.
- **Geocoding:** the API routes `/api/geo/search` and `/api/geo/reverse` call `nominatim.openstreetmap.org` with:
  - an identifying User-Agent;
  - `countrycodes=in`;
  - `addressdetails=1`;
  - a limit of 5 results.

  They also:
  - **cache** responses in memory (LRU, 24 hours);
  - **rate-limit** to one upstream request per second overall (requests over the limit get `503 GEO_UNAVAILABLE` with a retry hint);
  - **time out** upstream calls after 5 seconds.
- **Response mapping:** Nominatim's address parts become pincode (`postcode`), area (`suburb` / `neighbourhood` / `road`), city (`city` / `town` / `village` / `state_district`) and state.
- **Tests:** these never call Nominatim. The API tests inject a fake fetch, and E2E stubs the geo routes.

## Reason

It meets the brief's map flow at zero cost, respects the providers' policies, protects shoppers' privacy, and keeps the app fully usable without the external service.

## Consequences

- Indian address coverage in Nominatim is uneven, which is why every pre-filled field stays editable and manual entry is always offered.
- The public tile server and Nominatim are for light use only. Production would need its own tile and geocoding provider (CLAUDE.md §20).
- Requires network access when the map is used; offline shoppers get the manual form.
