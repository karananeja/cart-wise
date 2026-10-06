import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { openDatabase } from '../db/database.js';
import { createGeoService, toGeoPlace } from './service.js';

const indiranagar = {
  lat: '12.9784',
  lon: '77.6408',
  display_name: 'Indiranagar, Bengaluru, Bangalore North, Karnataka, 560038, India',
  address: { suburb: 'Indiranagar', city: 'Bengaluru', state: 'Karnataka', postcode: '560038', country_code: 'in' },
};

describe('toGeoPlace', () => {
  it('maps Nominatim address parts to our fields', () => {
    expect(toGeoPlace(indiranagar)).toEqual({
      label: 'Indiranagar, Bengaluru',
      latitude: 12.9784,
      longitude: 77.6408,
      pincode: '560038',
      area: 'Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
    });
  });

  it('falls back sensibly and drops invalid pincodes and unknown states', () => {
    const place = toGeoPlace({ lat: '1', lon: '2', display_name: 'Somewhere, Far', address: { town: 'Hampi', postcode: '58', state: 'Narnia' } });
    expect(place).toEqual({ label: 'Hampi', latitude: 1, longitude: 2, city: 'Hampi' });
  });
});

describe('geo service', () => {
  it('asks Nominatim politely (India only, identifying User-Agent) and caches', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify([indiranagar])));
    let now = 0;
    const geo = createGeoService({ fetch: fetch as unknown as typeof globalThis.fetch, clock: () => now });

    expect(await geo.search('  Indiranagar   Bengaluru ')).toHaveLength(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('countrycodes=in');
    expect(url).toContain('q=Indiranagar+Bengaluru');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/Cartwise/);

    now = 10;
    await geo.search('Indiranagar Bengaluru');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('spaces upstream requests at least a second apart, queueing rather than failing', async () => {
    const fetch = vi.fn(async () => new Response('[]'));
    const waits: number[] = [];
    const geo = createGeoService({
      fetch: fetch as unknown as typeof globalThis.fetch,
      clock: () => 0,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    await Promise.all([geo.search('first place'), geo.search('second place'), geo.search('third place')]);
    expect(waits).toEqual([1000, 2000]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('refuses when too many requests are already waiting', async () => {
    const geo = createGeoService({ fetch: (async () => new Response('[]')) as typeof globalThis.fetch, sleep: () => new Promise(() => {}) });
    // One request goes straight through, five may wait their turn, the seventh is refused.
    const pending = Array.from({ length: 7 }, (_, i) => geo.search(`place number ${i}`).catch((e: { code: string }) => e.code));
    await expect(Promise.race([pending[6], new Promise((r) => setTimeout(() => r('still waiting'), 50))])).resolves.toBe('GEO_UNAVAILABLE');
  });

  it('shows each place name and pincode once', async () => {
    const duplicate = { ...indiranagar, lat: '12.97841' };
    const fetch = async () => new Response(JSON.stringify([indiranagar, duplicate, { ...indiranagar, address: { ...indiranagar.address, postcode: '560008' } }]));
    const places = await createGeoService({ fetch: fetch as typeof globalThis.fetch }).search('Indiranagar');
    expect(places.map((p) => p.pincode)).toEqual(['560038', '560008']);
  });

  it('ignores very short queries without calling upstream', async () => {
    const fetch = vi.fn();
    expect(await createGeoService({ fetch: fetch as unknown as typeof globalThis.fetch }).search('ab')).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('geo routes', () => {
  it('serve search and reverse results, and report upstream failures as unavailable', async () => {
    const ok = createApp(openDatabase(':memory:'), {
      fetch: async (url) => new Response(JSON.stringify(String(url).includes('/reverse') ? indiranagar : [indiranagar])),
    });
    expect((await request(ok).get('/api/geo/search?q=Indiranagar').expect(200)).body.places[0].pincode).toBe('560038');
    expect((await request(ok).get('/api/geo/reverse?lat=12.97&lon=77.64').expect(200)).body.place.city).toBe('Bengaluru');
    await request(ok).get('/api/geo/reverse?lat=abc&lon=1').expect(400);

    const down = createApp(openDatabase(':memory:'), {
      fetch: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    const res = await request(down).get('/api/geo/search?q=Indiranagar').expect(503);
    expect(res.body.error.code).toBe('GEO_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED/);
  });
});
