import type { ProductSpecification } from '@store/shared';
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
      rating: Math.round(product.rating * 10) / 10,
      thumbnailUrl: product.thumbnail,
      imageUrls: product.images,
      specifications: specifications(product),
      tags: product.tags ?? [],
      catalogOrder: index,
    };
  });

  return { products: records, categories: [...categories.values()] };
}
