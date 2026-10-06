import { http, HttpResponse } from 'msw';
import { MAX_WISHLIST_ITEMS, type WishlistView } from '@store/shared';
import { productDetails } from './fixtures';

/** In-memory stand-in for the wishlist API (rules covered by the API tests). */
let saved: { slug: string; addedAt: string }[] = [];

export function resetWishlist() {
  saved = [];
}

function view(): WishlistView {
  const items = saved.map(({ slug, addedAt }) => ({ product: productDetails.find((p) => p.slug === slug)!, addedAt }));
  return { items, count: items.length };
}

export const wishlistHandlers = [
  http.get('*/api/wishlist', () => HttpResponse.json(view())),
  http.put('*/api/wishlist/items/:slug', ({ params }) => {
    const slug = String(params.slug);
    if (!productDetails.some((p) => p.slug === slug)) {
      return HttpResponse.json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'x' } }, { status: 404 });
    }
    if (!saved.some((s) => s.slug === slug)) {
      if (saved.length >= MAX_WISHLIST_ITEMS) return HttpResponse.json({ error: { code: 'WISHLIST_FULL', message: 'x' } }, { status: 409 });
      saved.unshift({ slug, addedAt: new Date().toISOString() });
    }
    return HttpResponse.json(view());
  }),
  http.delete('*/api/wishlist/items/:slug', ({ params }) => {
    saved = saved.filter((s) => s.slug !== params.slug);
    return HttpResponse.json(view());
  }),
];
