import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { resetAddresses } from './addressServer';
import { resetAuth } from './authServer';
import { resetCart } from './cartServer';
import { resetCheckout } from './checkoutServer';
import { resetDiscovery } from './discoveryServer';
import { resetOrders } from './ordersServer';
import { resetPayments } from './paymentServer';
import { resetSim } from './simServer';
import { resetWishlist } from './wishlistServer';
import { preloadRoutes } from '@/app/routes';
import { server } from './server';

// Lazily loaded pages compile once here, not inside each test's time limit.
beforeAll(() => preloadRoutes(), 60_000);

// jsdom gaps used by Radix primitives and the listing page.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= vi.fn();
Element.prototype.hasPointerCapture ??= () => false;
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetCart();
  resetCheckout();
  resetDiscovery();
  resetPayments();
  resetOrders();
  resetSim();
  resetAuth();
  resetAddresses();
  resetWishlist();
});
afterAll(() => server.close());
