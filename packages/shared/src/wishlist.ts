import type { ProductSummary } from './types.js';

export const MAX_WISHLIST_ITEMS = 100;

export interface WishlistItemView {
  product: ProductSummary;
  addedAt: string;
}

export interface WishlistView {
  /** Newest saved first, with current price and availability. */
  items: WishlistItemView[];
  count: number;
}

export const EMPTY_WISHLIST: WishlistView = { items: [], count: 0 };
