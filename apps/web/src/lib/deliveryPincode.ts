import { useSyncExternalStore } from 'react';
import { normalizePincode } from '@store/shared';

const STORAGE_KEY = 'store.deliveryPincode';
const listeners = new Set<() => void>();
let cache: string | null | undefined;

function read(): string | null {
  if (cache !== undefined) return cache;
  try {
    cache = normalizePincode(localStorage.getItem(STORAGE_KEY) ?? '');
  } catch {
    cache = null;
  }
  return cache;
}

/** Remembers the pincode the shopper checked (F-015), on this device only. Never throws. */
export function saveDeliveryPincode(pincode: string | null) {
  cache = pincode;
  try {
    if (pincode) localStorage.setItem(STORAGE_KEY, pincode);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: remembered for this session only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cache = undefined;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useSavedDeliveryPincode(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Tests only. */
export function resetDeliveryPincodeCache() {
  cache = undefined;
}
