/** Shape of the upstream DummyJSON product. Only the catalog layer may import this file. */
export interface DummyJsonProduct {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  tags?: string[];
  brand?: string;
  sku?: string;
  weight?: number;
  dimensions?: { width: number; height: number; depth: number };
  warrantyInformation?: string;
  shippingInformation?: string;
  reviews?: { rating: number; comment: string; date: string; reviewerName: string; reviewerEmail: string }[];
  images: string[];
  thumbnail: string;
  // Upstream stock fields (stock, availabilityStatus, minimumOrderQuantity) are deliberately
  // not modelled: inventory is application-owned (ADR-002).
}

export interface CatalogSnapshot {
  source: string;
  fetchedAt: string;
  products: DummyJsonProduct[];
}
