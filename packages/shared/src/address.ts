import { normalizeMobile } from './auth.js';

/** States and union territories of India, for the address form's state list. */
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
] as const;

export const ADDRESS_TYPES = ['home', 'work', 'other'] as const;
export type AddressType = (typeof ADDRESS_TYPES)[number];
export const MAX_ADDRESSES = 10;

export interface AddressInput {
  fullName: string;
  mobile: string;
  pincode: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  type: AddressType;
  latitude: number | null;
  longitude: number | null;
}

export interface Address extends AddressInput {
  id: number;
  isDefault: boolean;
  createdAt: string;
}

export type AddressField = 'fullName' | 'mobile' | 'pincode' | 'line1' | 'line2' | 'landmark' | 'city' | 'state' | 'type';
export type AddressErrors = Partial<Record<AddressField, string>>;

/** A place from the map search or a map position (all parts optional; Nominatim is approximate). */
export interface GeoPlace {
  label: string;
  latitude: number;
  longitude: number;
  pincode?: string;
  area?: string;
  city?: string;
  state?: string;
}

/** Matches a free-text state name to the official list, case-insensitively. */
export function matchState(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const wanted = name.trim().toLowerCase();
  return INDIAN_STATES.find((s) => s.toLowerCase() === wanted || (wanted === 'nct of delhi' && s === 'Delhi'));
}

/** Field errors (empty when valid) and normalised values for an address form or request. */
export function checkAddress(input: Partial<Record<keyof AddressInput, unknown>>): { errors: AddressErrors; values: AddressInput } {
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const errors: AddressErrors = {};

  const fullName = text(input.fullName, 60);
  if (fullName.length < 2) errors.fullName = 'Enter the recipient’s name';
  const mobile = normalizeMobile(text(input.mobile, 20));
  if (!mobile) errors.mobile = 'Enter a 10-digit Indian mobile number';
  const pincode = text(input.pincode, 10).replace(/\s/g, '');
  if (!/^[1-9]\d{5}$/.test(pincode)) errors.pincode = 'Enter a 6-digit pincode';
  const line1 = text(input.line1, 100);
  if (!line1) errors.line1 = 'Enter flat, house or building';
  const line2 = text(input.line2, 120);
  if (!line2) errors.line2 = 'Enter area, street or locality';
  const landmark = text(input.landmark, 80);
  const city = text(input.city, 60);
  if (!city) errors.city = 'Enter the city';
  const state = matchState(text(input.state, 60));
  if (!state) errors.state = 'Choose a state';
  const type = ADDRESS_TYPES.includes(input.type as AddressType) ? (input.type as AddressType) : undefined;
  if (!type) errors.type = 'Choose Home, Work or Other';

  const coordinate = (v: unknown, limit: number) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= limit ? v : null);
  let latitude = coordinate(input.latitude, 90);
  let longitude = coordinate(input.longitude, 180);
  if (latitude === null || longitude === null) latitude = longitude = null;

  return {
    errors,
    values: { fullName, mobile: mobile ?? '', pincode, line1, line2, landmark, city, state: state ?? '', type: type ?? 'home', latitude, longitude },
  };
}
