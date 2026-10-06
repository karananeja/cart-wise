import type { ProductReview, ProductSpecification } from '@store/shared';
import type { DummyJsonProduct } from './dummyjson.js';

export interface ProductRecord {
  id: number;
  slug: string;
  externalCatalogId: string;
  title: string;
  description: string;
  brand: string | null;
  brandSlug: string | null;
  categorySlug: string;
  mrpPaise: number;
  pricePaise: number;
  discountPercent: number;
  rating: number;
  reviews: ProductReview[];
  thumbnailUrl: string;
  imageUrls: string[];
  specifications: ProductSpecification[];
  tags: string[];
  catalogOrder: number;
}

export interface CategoryRecord {
  slug: string;
  name: string;
  imageUrl: string;
  sortOrder: number;
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const CATEGORY_WORDS: Record<string, string> = { mens: "Men's", womens: "Women's" };

export function categoryName(slug: string): string {
  return slug
    .split('-')
    .map((word) => CATEGORY_WORDS[word] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function toPaise(usd: number, rate: number): number {
  return Math.round(usd * 100 * rate);
}

/** Upstream `price` is the original price; the selling price applies the discount. */
export function applyDiscount(mrpPaise: number, discountPercentage: number): { pricePaise: number; discountPercent: number } {
  const discountPercent = Math.round(discountPercentage);
  if (discountPercent < 1) return { pricePaise: mrpPaise, discountPercent: 0 };
  return { pricePaise: Math.round(mrpPaise * (1 - discountPercentage / 100)), discountPercent };
}

/**
 * The displayed rating is the mean of the reviews shown (Q15): upstream `rating` contradicts
 * its own reviews for many products. Falls back to the upstream rating when there are none.
 */
export function ratingFromReviews(reviews: { rating: number }[], fallback: number): number {
  const value = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : fallback;
  return Math.round(value * 10) / 10;
}

function specifications(product: DummyJsonProduct): ProductSpecification[] {
  const specs: ProductSpecification[] = [];
  if (product.warrantyInformation) specs.push({ label: 'Warranty', value: product.warrantyInformation });
  if (product.shippingInformation) specs.push({ label: 'Shipping', value: product.shippingInformation });
  return specs;
}

export function mapCatalog(
  products: DummyJsonProduct[],
  rate: number,
): { products: ProductRecord[]; categories: CategoryRecord[] } {
  const usedSlugs = new Set<string>();
  const categories = new Map<string, CategoryRecord>();

  const records = products.map((product, index): ProductRecord => {
    let slug = slugify(product.title) || `product-${product.id}`;
    if (usedSlugs.has(slug)) slug = `${slug}-${product.id}`;
    usedSlugs.add(slug);

    if (!categories.has(product.category)) {
      categories.set(product.category, {
        slug: product.category,
        name: categoryName(product.category),
        imageUrl: product.thumbnail,
        sortOrder: categories.size,
      });
    }

    const mrpPaise = toPaise(product.price, rate);
    const brand = product.brand?.trim() || null;
    // Reviewer emails and dates are dropped: not needed, and emails look like personal data.
    const reviews = (product.reviews ?? []).map((r) => ({ rating: r.rating, comment: r.comment, reviewerName: r.reviewerName }));
    return {
      id: product.id,
      slug,
      externalCatalogId: `dummyjson:${product.id}`,
      title: product.title,
      description: product.description,
      brand,
      brandSlug: brand ? slugify(brand) : null,
      categorySlug: product.category,
      mrpPaise,
      ...applyDiscount(mrpPaise, product.discountPercentage),
      rating: ratingFromReviews(reviews, product.rating),
      reviews,
      thumbnailUrl: product.thumbnail,
      imageUrls: product.images,
      specifications: specifications(product),
      tags: product.tags ?? [],
      catalogOrder: index,
    };
  });

  return { products: records, categories: [...categories.values()] };
}
