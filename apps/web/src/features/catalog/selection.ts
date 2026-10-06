import { useSearchParams } from 'react-router';
import type { ProductDetail, ProductOption, ProductSize } from '@store/shared';

/** Only an existing, in-stock size from the URL counts as selected (F-003 spec FR-10). */
export function useSelectedSize(p: ProductDetail | undefined): ProductSize | undefined {
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('size');
  return p?.sizes.find((s) => s.label === requested && s.availability.status !== 'out_of_stock');
}

/**
 * The option from the URL if it exists and is in stock, otherwise the cheapest in-stock option
 * (F-013 D2: options arrive cheapest first). Undefined when every option is sold out.
 */
export function useSelectedOption(p: ProductDetail | undefined): ProductOption | undefined {
  const [searchParams] = useSearchParams();
  return defaultOption(p?.options ?? [], searchParams.get('option'));
}

export function defaultOption(options: ProductOption[], requested?: string | null): ProductOption | undefined {
  const inStock = options.filter((o) => o.availability.status !== 'out_of_stock');
  return inStock.find((o) => o.label === requested) ?? inStock[0];
}

/** Where a cart or order line links back to: the product with its size or option chosen. */
export function productLink(slug: string, unit: { size?: string | null; option?: string | null }): string {
  if (unit.size) return `/p/${slug}?size=${encodeURIComponent(unit.size)}`;
  if (unit.option) return `/p/${slug}?option=${encodeURIComponent(unit.option)}`;
  return `/p/${slug}`;
}

/** How a line names its unit: "Size: M", or the option itself ("256 GB"). */
export function unitLabel(unit: { size?: string | null; option?: string | null }): string | null {
  if (unit.size) return `Size: ${unit.size}`;
  return unit.option ?? null;
}
