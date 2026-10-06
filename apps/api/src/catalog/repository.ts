import type { Category, ProductDetail, ProductSpecification } from '@store/shared';
import type { Db } from '../db/database.js';
import { deriveAvailability } from '../inventory/inventory.js';
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
  on_hand: number;
  reserved: number;
}

const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name, i.on_hand, i.reserved
  FROM products p
  JOIN categories c ON c.slug = p.category_slug
  JOIN inventory i ON i.product_id = p.id`;

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
      thumbnailUrl: row.thumbnail_url,
      availability: deriveAvailability(row.on_hand, row.reserved),
    },
    brandSlug: row.brand_slug,
    available: Math.max(0, row.on_hand - row.reserved),
    catalogOrder: row.catalog_order,
  };
}

export function createCatalogRepository(db: Db) {
  const allProducts = db.prepare(`${PRODUCT_SELECT} ORDER BY p.catalog_order`);
  const productBySlug = db.prepare(`${PRODUCT_SELECT} WHERE p.slug = ?`);
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
      };
    },
  };
}

export type CatalogRepository = ReturnType<typeof createCatalogRepository>;
