import { http, HttpResponse } from 'msw';
import type { CartRecommendations, HomeRecommendations, ProductRecommendations, ProductSummary, RecommendedProduct } from '@store/shared';

/** Recommendation API stand-in: tests set what each endpoint returns. Defaults are empty. */
let productRecs = new Map<string, ProductRecommendations>();
let home: HomeRecommendations = { becauseViewed: null, becauseBought: null };
let cart: CartRecommendations = { items: [] };
let failing = false;
/** The `viewed` query of each home request, for assertions. */
export const homeRequests: (string | null)[] = [];

export const recommended = (p: ProductSummary, needsSize = false): RecommendedProduct => ({ ...p, needsSize });

export function setProductRecommendations(slug: string, value: ProductRecommendations) {
  productRecs.set(slug, value);
}
export function setHomeRecommendations(value: HomeRecommendations) {
  home = value;
}
export function setCartRecommendations(value: CartRecommendations) {
  cart = value;
}
/** Every recommendation endpoint answers 500. */
export function failRecommendations() {
  failing = true;
}

export function resetDiscovery() {
  productRecs = new Map();
  home = { becauseViewed: null, becauseBought: null };
  cart = { items: [] };
  failing = false;
  homeRequests.length = 0;
}

const failure = () => HttpResponse.json({ error: { code: 'INTERNAL', message: 'x' } }, { status: 500 });

export const discoveryHandlers = [
  http.get('*/api/products/:slug/recommendations', ({ params }) =>
    failing ? failure() : HttpResponse.json(productRecs.get(String(params.slug)) ?? { pairing: null, similar: [] }),
  ),
  http.get('*/api/recommendations/home', ({ request }) => {
    homeRequests.push(new URL(request.url).searchParams.get('viewed'));
    return failing ? failure() : HttpResponse.json(home);
  }),
  http.get('*/api/cart/recommendations', () => (failing ? failure() : HttpResponse.json(cart))),
];
