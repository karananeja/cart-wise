import { describe, expect, it } from 'vitest';
import { deliveryZone, normalizePincode } from './serviceability.js';

describe('normalizePincode', () => {
  it('accepts 6 digits not starting with 0, ignoring spaces', () => {
    expect(normalizePincode('560 038')).toBe('560038');
    expect(normalizePincode(' 110001 ')).toBe('110001');
  });

  it('refuses anything else', () => {
    for (const bad of ['', '12345', '012345', '1234567', '56003a', '56-0038']) expect(normalizePincode(bad)).toBeNull();
  });
});

describe('deliveryZone', () => {
  it.each([
    ['110001', 'metro'],
    ['122002', 'metro'],
    ['201301', 'metro'],
    ['400001', 'metro'],
    ['411001', 'metro'],
    ['380001', 'metro'],
    ['500001', 'metro'],
    ['560038', 'metro'],
    ['600001', 'metro'],
    ['700001', 'metro'],
    ['302001', 'regional'],
    ['123401', 'regional'],
    ['682550', 'regional'],
    ['682560', 'regional'],
    ['190001', 'remote'],
    ['194101', 'remote'],
    ['737101', 'remote'],
    ['781001', 'remote'],
    ['795001', 'remote'],
    ['744101', 'unserviceable'],
    ['682551', 'unserviceable'],
    ['682559', 'unserviceable'],
    ['900001', 'unserviceable'],
    ['999999', 'unserviceable'],
  ])('%s is %s', (pincode, zone) => {
    expect(deliveryZone(pincode)).toBe(zone);
  });
});
