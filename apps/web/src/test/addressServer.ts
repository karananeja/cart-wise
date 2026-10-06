import { http, HttpResponse } from 'msw';
import { checkAddress, MAX_ADDRESSES, type Address, type GeoPlace } from '@store/shared';

/** In-memory addresses for the signed-in test user, plus a fake geocoder (rules covered by API tests). */
let addresses: Address[] = [];
let nextId = 1;
export let geoAvailable = true;

export const INDIRANAGAR: GeoPlace = {
  label: 'Indiranagar, Bengaluru',
  latitude: 12.9784,
  longitude: 77.6408,
  pincode: '560038',
  area: 'Indiranagar',
  city: 'Bengaluru',
  state: 'Karnataka',
};

export function resetAddresses() {
  addresses = [];
  nextId = 1;
  geoAvailable = true;
}

export function setGeoAvailable(available: boolean) {
  geoAvailable = available;
}

const sorted = () => [...addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.id - a.id);
const error = (status: number, code: string, details?: Record<string, unknown>) =>
  HttpResponse.json({ error: { code, message: code, ...(details ? { details } : {}) } }, { status });

export const addressHandlers = [
  http.get('*/api/addresses', () => HttpResponse.json({ addresses: sorted() })),
  http.post('*/api/addresses/:id/default', ({ params }) => {
    addresses = addresses.map((a) => ({ ...a, isDefault: a.id === Number(params.id) }));
    return HttpResponse.json({ addresses: sorted() });
  }),
  http.post('*/api/addresses', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const { errors, values } = checkAddress(body);
    if (Object.keys(errors).length) return error(400, 'VALIDATION', { fields: errors });
    if (addresses.length >= MAX_ADDRESSES) return error(409, 'ADDRESS_LIMIT');
    const makeDefault = addresses.length === 0 || body.makeDefault === true;
    if (makeDefault) addresses = addresses.map((a) => ({ ...a, isDefault: false }));
    addresses.push({ ...values, id: nextId++, isDefault: makeDefault, createdAt: new Date().toISOString() });
    return HttpResponse.json({ addresses: sorted() });
  }),
  http.put('*/api/addresses/:id', async ({ params, request }) => {
    const { values } = checkAddress((await request.json()) as Record<string, unknown>);
    addresses = addresses.map((a) => (a.id === Number(params.id) ? { ...a, ...values } : a));
    return HttpResponse.json({ addresses: sorted() });
  }),
  http.delete('*/api/addresses/:id', ({ params }) => {
    const removed = addresses.find((a) => a.id === Number(params.id));
    addresses = addresses.filter((a) => a.id !== Number(params.id));
    let promotedId: number | null = null;
    if (removed?.isDefault && addresses.length) {
      const newest = [...addresses].sort((a, b) => b.id - a.id)[0]!;
      newest.isDefault = true;
      promotedId = newest.id;
    }
    return HttpResponse.json({ addresses: sorted(), promotedId });
  }),
  http.get('*/api/geo/search', ({ request }) => {
    if (!geoAvailable) return error(503, 'GEO_UNAVAILABLE');
    const q = new URL(request.url).searchParams.get('q') ?? '';
    return HttpResponse.json({ places: /indira/i.test(q) ? [INDIRANAGAR] : [] });
  }),
  http.get('*/api/geo/reverse', () => {
    if (!geoAvailable) return error(503, 'GEO_UNAVAILABLE');
    return HttpResponse.json({ place: { ...INDIRANAGAR, label: 'HAL 2nd Stage, Bengaluru', area: 'HAL 2nd Stage' } });
  }),
];

/** Current mock addresses (default first), for the checkout mock. */
export const addressList = () => sorted();
