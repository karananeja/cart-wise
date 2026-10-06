import type { Category, ProductDetail, ProductOption, ProductReview, ProductSize, ProductSpecification } from '@store/shared';
import type { Db } from '../db/database.js';
import { deriveAvailability } from '../inventory/inventory.js';
import { OPTION_NAMES } from '../inventory/options.js';
import type { SearchDocument } from '../search/searchIndex.js';
import type { CatalogItem } from './query.js';

interface ProductRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  brand: string | null;
  brand_slug: string | null;
  category_slug: string;
  category_name: string;
  mrp_paise: number;
  price_paise: number;
  discount_percent: number;
  rating: number;
  thumbnail_url: string;
  image_urls: string;
  specifications: string;
  catalog_order: number;
  review_count: number;
  /** Units available across all sizes or options: sum of max(0, on_hand - reserved) per unit. */
  available: number;
  has_options: 0 | 1;
}

const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name,
    (SELECT COALESCE(SUM(MAX(i.on_hand - i.reserved, 0)), 0) FROM inventory i WHERE i.product_id = p.id) AS available,
    (SELECT COUNT(*) FROM product_reviews r WHERE r.product_id = p.id) AS review_count,
    EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.kind = 'option') AS has_options
  FROM products p
  JOIN categories c ON c.slug = p.category_slug`;

function toItem(row: ProductRow): CatalogItem {
  return {
    summary: {
      id: row.id,
      slug: row.slug,
      title: row.title,
      brand: row.brand,
      categorySlug: row.category_slug,
      mrpPaise: row.mrp_paise,
      pricePaise: row.price_paise,
      discountPercent: row.discount_percent,
      rating: row.rating,
      reviewCount: row.review_count,
      thumbnailUrl: row.thumbnail_url,
      availability: deriveAvailability(row.available),
      hasOptions: row.has_options === 1,
    },
    brandSlug: row.brand_slug,
    available: row.available,
    catalogOrder: row.catalog_order,
  };
}

export function createCatalogRepository(db: Db) {
  const allProducts = db.prepare(`${PRODUCT_SELECT} ORDER BY p.catalog_order`);
  const productBySlug = db.prepare(`${PRODUCT_SELECT} WHERE p.slug = ?`);
  const sizesForProduct = db.prepare(`
    SELECT v.label, MAX(i.on_hand - i.reserved, 0) AS available
    FROM product_variants v JOIN inventory i ON i.variant_id = v.id
    WHERE v.product_id = ? AND v.kind = 'size' ORDER BY v.sort_order`);
  const optionsForProduct = db.prepare(`
    SELECT v.label, v.mrp_paise AS mrpPaise, v.price_paise AS pricePaise, v.discount_percent AS discountPercent,
      MAX(i.on_hand - i.reserved, 0) AS available
    FROM product_variants v JOIN inventory i ON i.variant_id = v.id
    WHERE v.product_id = ? AND v.kind = 'option' ORDER BY v.sort_order`);
  const reviewsForProduct = db.prepare(
    'SELECT rating, comment, reviewer_name AS reviewerName FROM product_reviews WHERE product_id = ? ORDER BY sort_order',
  );
  const categories = db.prepare(`
    SELECT c.slug, c.name, c.image_url AS imageUrl, COUNT(p.id) AS productCount
    FROM categories c LEFT JOIN products p ON p.category_slug = c.slug
    GROUP BY c.slug ORDER BY c.name`);
  const categoryExists = db.prepare('SELECT 1 FROM categories WHERE slug = ?');
  const searchDocuments = db.prepare(`
    SELECT p.id, p.title, p.brand, p.description, p.tags, p.category_slug AS categorySlug, c.name AS categoryName
    FROM products p JOIN categories c ON c.slug = p.category_slug`);

  return {
    listItems: (): CatalogItem[] => (allProducts.all() as ProductRow[]).map(toItem),
    listCategories: (): Category[] => categories.all() as Category[],
    categoryExists: (slug: string): boolean => categoryExists.get(slug) !== undefined,
    listSearchDocuments: (): SearchDocument[] =>
      (searchDocuments.all() as (Omit<SearchDocument, 'tags'> & { tags: string })[]).map((row) => ({
        ...row,
        tags: JSON.parse(row.tags) as string[],
      })),
    findProduct(slug: string): ProductDetail | undefined {
      const row = productBySlug.get(slug) as ProductRow | undefined;
      if (!row) return undefined;
      return {
        ...toItem(row).summary,
        description: row.description,
        categoryName: row.category_name,
        imageUrls: JSON.parse(row.image_urls) as string[],
        specifications: JSON.parse(row.specifications) as ProductSpecification[],
        sizes: (sizesForProduct.all(row.id) as { label: string; available: number }[]).map(
          (s): ProductSize => ({ label: s.label, availability: deriveAvailability(s.available) }),
        ),
        options: (optionsForProduct.all(row.id) as (Omit<ProductOption, 'availability'> & { available: number })[]).map(
          ({ available, ...option }): ProductOption => ({ ...option, availability: deriveAvailability(available) }),
        ),
        optionName: row.has_options ? (OPTION_NAMES[row.category_slug] ?? 'Option') : null,
        reviews: reviewsForProduct.all(row.id) as ProductReview[],
      };
    },
    /** Summaries for the given slugs, in the same order; unknown slugs are skipped. */
    findSummaries(slugs: string[]) {
      if (!slugs.length) return [];
      const rows = db.prepare(`${PRODUCT_SELECT} WHERE p.slug IN (${slugs.map(() => '?').join(',')})`).all(...slugs) as ProductRow[];
      const bySlug = new Map(rows.map((row) => [row.slug, toItem(row).summary]));
      return slugs.flatMap((slug) => bySlug.get(slug) ?? []);
    },
  };
}

export type CatalogRepository = ReturnType<typeof createCatalogRepository>;
