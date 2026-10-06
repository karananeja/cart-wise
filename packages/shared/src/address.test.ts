import { describe, expect, it } from 'vitest';
import { checkAddress, matchState } from './address.js';

const valid = {
  fullName: 'Karan Aneja',
  mobile: '+91 98765 43210',
  pincode: '560 038',
  line1: 'Flat 4B, Lake View',
  line2: '12th Main, Indiranagar',
  landmark: '',
  city: 'Bengaluru',
  state: 'karnataka',
  type: 'home',
  latitude: 12.97,
  longitude: 77.64,
};

describe('checkAddress', () => {
  it('normalises a valid address', () => {
    const { errors, values } = checkAddress(valid);
    expect(errors).toEqual({});
    expect(values).toMatchObject({ mobile: '9876543210', pincode: '560038', state: 'Karnataka', latitude: 12.97 });
  });

  it('reports every invalid field', () => {
    const { errors } = checkAddress({ pincode: '012345', state: 'Atlantis', type: 'castle' });
    expect(Object.keys(errors).sort()).toEqual(['city', 'fullName', 'line1', 'line2', 'mobile', 'pincode', 'state', 'type']);
  });

  it('drops half or out-of-range coordinates', () => {
    expect(checkAddress({ ...valid, longitude: undefined }).values).toMatchObject({ latitude: null, longitude: null });
    expect(checkAddress({ ...valid, latitude: 120 }).values.latitude).toBeNull();
  });
});

it('matches state names to the official list', () => {
  expect(matchState('TAMIL NADU')).toBe('Tamil Nadu');
  expect(matchState('NCT of Delhi')).toBe('Delhi');
  expect(matchState('Ontario')).toBeUndefined();
});
