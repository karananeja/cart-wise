import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { parseListingParams, type AnalyticsEvent } from '@store/shared';
import { addressHandlers } from './addressServer';
import { authHandlers } from './authServer';
import { cartHandlers } from './cartServer';
import { checkoutHandlers } from './checkoutServer';
import { discoveryHandlers } from './discoveryServer';
import { newsletterHandlers } from './newsletterServer';
import { ordersHandlers } from './ordersServer';
import { paymentHandlers } from './paymentServer';
import { simHandlers } from './simServer';
import { wishlistHandlers } from './wishlistServer';
import { categories, listing, productDetails, products } from './fixtures';

/** Analytics events received by the mock API during a test. */
export const receivedEvents: AnalyticsEvent[] = [];

/**
 * A small stand-in for the API: filters fixtures by category, brand and rating, which is all
 * the component tests rely on. The real query logic is covered by the API tests.
 */
export const handlers = [
  ...authHandlers,
  ...discoveryHandlers,
  ...addressHandlers,
  ...cartHandlers,
  ...paymentHandlers,
  ...ordersHandlers,
  ...checkoutHandlers,
  ...simHandlers,
  ...wishlistHandlers,
  ...newsletterHandlers,
  http.get('*/api/categories', () => HttpResponse.json({ categories })),
  http.get('*/api/products', ({ request }) => {
    const params = parseListingParams(new URL(request.url).searchParams);
    if (params.category && !categories.some((c) => c.slug === params.category)) {
      return HttpResponse.json({ error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' } }, { status: 404 });
    }
    const q = params.q?.toLowerCase();
    const items = products.filter(
      (p) =>
        (!q || p.title.toLowerCase().includes(q) || p.categorySlug.includes(q)) &&
        (!params.category || p.categorySlug === params.category) &&
        (!params.brands.length || params.brands.includes((p.brand ?? '').toLowerCase())) &&
        (!params.rating || p.rating >= params.rating),
    );
    return HttpResponse.json(listing(items, q ? { search: { query: params.q!, matchMode: 'all' } } : {}));
  }),
  http.get('*/api/search/suggestions', ({ request }) => {
    const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase();
    return HttpResponse.json({
      categories: categories.filter((c) => c.slug.startsWith(q)).map(({ slug, name }) => ({ slug, name })),
      products: products.filter((p) => p.title.toLowerCase().includes(q)).slice(0, 5),
    });
  }),
  http.get('*/api/products/batch', ({ request }) => {
    const slugs = (new URL(request.url).searchParams.get('slugs') ?? '').split(',');
    return HttpResponse.json({ items: slugs.flatMap((slug) => productDetails.filter((p) => p.slug === slug)) });
  }),
  http.get('*/api/products/:slug', ({ params }) => {
    const product = productDetails.find((p) => p.slug === params.slug);
    return product
      ? HttpResponse.json({ product })
      : HttpResponse.json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } }, { status: 404 });
  }),
  http.post('*/api/events', async ({ request }) => {
    const body = (await request.json()) as { events: AnalyticsEvent[] };
    receivedEvents.push(...body.events);
    return new HttpResponse(null, { status: 202 });
  }),
];

export const server = setupServer(...handlers);
