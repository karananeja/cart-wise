/** Application-owned size sets by category (F-003 spec FR-6, approved 2026-10-06). */
const APPAREL_MEN = ['S', 'M', 'L', 'XL', 'XXL'];
const APPAREL_WOMEN = ['XS', 'S', 'M', 'L', 'XL'];

export const SIZE_SETS: Record<string, string[]> = {
  'mens-shirts': APPAREL_MEN,
  'womens-dresses': APPAREL_WOMEN,
  tops: APPAREL_WOMEN,
  'mens-shoes': ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'],
  'womens-shoes': ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8'],
};

export function sizesFor(categorySlug: string): string[] {
  return SIZE_SETS[categorySlug] ?? [];
}
