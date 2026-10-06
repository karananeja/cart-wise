import { matchState, type GeoPlace } from '@store/shared';
import { HttpError } from '../http/errors.js';

/**
 * Nominatim (OpenStreetMap) search and reverse lookup, used only through our API (ADR-004):
 * identifying User-Agent, India only, at most one upstream request per second, results cached
 * for a day, 5-second timeout. Tests inject `fetch`, so they never reach the network.
 */
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'Cartwise-demo-store/0.1 (local development; OpenStreetMap usage policy)';
const CACHE_LIMIT = 500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 1000;
const TIMEOUT_MS = 5000;
/** Requests waiting for their turn beyond this are refused rather than queued. */
const MAX_QUEUED = 5;

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string | undefined>;
  error?: string;
}

export function toGeoPlace(place: NominatimPlace): GeoPlace {
  const a = place.address ?? {};
  const area = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.road ?? a.hamlet;
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.state_district ?? a.county;
  const pincode = a.postcode?.replace(/\s/g, '');
  const parts = [area, city].filter(Boolean);
  return {
    label: parts.length ? parts.join(', ') : place.display_name.split(',').slice(0, 2).join(','),
    latitude: Number(place.lat),
    longitude: Number(place.lon),
    ...(pincode && /^[1-9]\d{5}$/.test(pincode) ? { pincode } : {}),
    ...(area ? { area } : {}),
    ...(city ? { city } : {}),
    ...(matchState(a.state) ? { state: matchState(a.state) } : {}),
  };
}

export function createGeoService(deps: { fetch: typeof fetch; clock?: () => number; sleep?: (ms: number) => Promise<void> }) {
  const clock = deps.clock ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const cache = new Map<string, { at: number; value: unknown }>();
  let nextSlotAt = -Infinity;
  let queued = 0;

  /** Spaces upstream requests at least a second apart; a short queue waits, beyond it is refused. */
  async function waitTurn() {
    if (queued >= MAX_QUEUED) {
      throw new HttpError(503, 'GEO_UNAVAILABLE', 'Location search is busy. Please try again.', { retryAfterSeconds: 1 });
    }
    const slot = Math.max(clock(), nextSlotAt);
    nextSlotAt = slot + MIN_INTERVAL_MS;
    const wait = slot - clock();
    if (wait <= 0) return;
    queued += 1;
    try {
      await sleep(wait);
    } finally {
      queued -= 1;
    }
  }

  async function call<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = `${NOMINATIM}${path}?${new URLSearchParams({ format: 'jsonv2', addressdetails: '1', ...params })}`;
    const hit = cache.get(url);
    if (hit && clock() - hit.at < CACHE_TTL_MS) return hit.value as T;

    await waitTurn();
    let response: Response;
    try {
      response = await deps.fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new HttpError(503, 'GEO_UNAVAILABLE', 'Location search is not available right now.');
    }
    if (!response.ok) throw new HttpError(503, 'GEO_UNAVAILABLE', 'Location search is not available right now.');
    const value = (await response.json()) as T;
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(url, { at: clock(), value });
    return value;
  }

  return {
    async search(query: string): Promise<GeoPlace[]> {
      const q = query.replace(/\s+/g, ' ').trim().slice(0, 120);
      if (q.length < 3) return [];
      const places = await call<NominatimPlace[]>('/search', { q, countrycodes: 'in', limit: '5' });
      return places.map(toGeoPlace);
    },

    async reverse(latitude: number, longitude: number): Promise<GeoPlace | null> {
      // Rounded to ~10 m so nearby taps share a cache entry.
      const place = await call<NominatimPlace>('/reverse', { lat: latitude.toFixed(4), lon: longitude.toFixed(4), zoom: '18' });
      if (place.error) return null;
      return toGeoPlace(place);
    },
  };
}

export type GeoService = ReturnType<typeof createGeoService>;
