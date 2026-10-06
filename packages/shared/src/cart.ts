import { z } from 'zod';
import type { Availability, ProductSummary } from './types.js';

export const MAX_PER_LINE = 10;

export type CartLineIssue = 'none' | 'exceeds_stock' | 'out_of_stock';

export interface CartLineView {
  id: number;
  product: ProductSummary;
  /** Size label, or null for products without sizes. */
  size: string | null;
  quantity: number;
  /** Availability of this exact size (or product). */
  availability: Availability;
  /** Most this line can be increased to: min(10, available). */
  maxQuantity: number;
  issue: CartLineIssue;
  linePricePaise: number;
  lineMrpPaise: number;
}

export interface CartView {
  lines: CartLineView[];
  /** All units in the cart, including lines with issues (header badge). */
  totalQuantity: number;
  /** Totals cover only lines that can be bought now. */
  totals: { itemCount: number; mrpPaise: number; discountPaise: number; subtotalPaise: number };
  hasIssues: boolean;
}

export const EMPTY_CART: CartView = {
  lines: [],
  totalQuantity: 0,
  totals: { itemCount: 0, mrpPaise: 0, discountPaise: 0, subtotalPaise: 0 },
  hasIssues: false,
};

export const addToCartSchema = z.object({
  productSlug: z.string().min(1).max(200),
  size: z.string().min(1).max(20).nullish(),
  quantity: z.number().int().min(1).max(MAX_PER_LINE).default(1),
});
export type AddToCartRequest = z.input<typeof addToCartSchema>;

export const updateCartLineSchema = z.object({
  quantity: z.number().int().min(1).max(MAX_PER_LINE),
});

export type CartErrorCode =
  | 'SIZE_REQUIRED'
  | 'INVALID_SIZE'
  | 'PRODUCT_NOT_FOUND'
  | 'OUT_OF_STOCK'
  | 'QUANTITY_LIMIT'
  | 'LINE_NOT_FOUND';
