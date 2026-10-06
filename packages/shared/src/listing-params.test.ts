import { describe, expect, it } from 'vitest';
import { countActiveFilters, parseListingParams, serializeListingParams } from './listing-params.js';

const parse = (qs: string) => parseListingParams(new URLSearchParams(qs));

describe('parseListingParams', () => {
  it('returns defaults for an empty query', () => {
    expect(parse('')).toEqual({ brands: [], inStock: false, sort: 'featured', page: 1, pageSize: 24 });
  });

  it('parses every supported parameter', () => {
    expect(parse('category=laptops&brand=asus,apple&price=500-1500&rating=4&inStock=1&sort=price_asc&page=2')).toEqual({
      category: 'laptops',
      brands: ['apple', 'asus'],
      priceMin: 500,
      priceMax: 1500,
      rating: 4,
      inStock: true,
      sort: 'price_asc',
      page: 2,
      pageSize: 24,
    });
  });

  it('drops invalid values instead of throwing', () => {
    expect(parse('category=Bad Slug&brand=ok,NOT OK,,&price=abc&rating=5&inStock=yes&sort=cheapest&page=-3&pageSize=0')).toEqual({
      brands: ['ok'],
      inStock: false,
      sort: 'featured',
      page: 1,
      pageSize: 24,
    });
  });

  it('accepts open-ended price ranges and swaps reversed bounds', () => {
    expect(parse('price=100-')).toMatchObject({ priceMin: 100 });
    expect(parse('price=-100')).toMatchObject({ priceMax: 100 });
    expect(parse('price=900-100')).toMatchObject({ priceMin: 100, priceMax: 900 });
    expect(parse('price=0-100')).not.toHaveProperty('priceMin');
  });

  it('caps page size and de-duplicates brands', () => {
    expect(parse('pageSize=500').pageSize).toBe(48);
    expect(parse('brand=b,a,b').brands).toEqual(['a', 'b']);
  });

  it('accepts a plain object (API request query)', () => {
    expect(parseListingParams({ sort: 'rating', brand: ['ignored-array'] })).toMatchObject({ sort: 'rating', brands: [] });
  });
});

describe('serializeListingParams', () => {
  it('omits defaults', () => {
    expect(serializeListingParams(parse('')).toString()).toBe('');
  });

  it('round-trips through parse', () => {
    const qs = 'category=laptops&brand=apple%2Casus&price=500-&rating=3&inStock=1&sort=discount&page=3';
    const params = parse(qs);
    expect(parseListingParams(serializeListingParams(params))).toEqual(params);
  });

  it('can omit the category for category pages', () => {
    expect(serializeListingParams({ category: 'laptops', inStock: true }, { omitCategory: true }).toString()).toBe('inStock=1');
  });
});

describe('countActiveFilters', () => {
  it('counts each brand, price range, rating, stock toggle and optionally category', () => {
    const params = parse('category=x&brand=a,b&price=1-2&rating=4&inStock=1&sort=rating&page=2');
    expect(countActiveFilters(params, { includeCategory: true })).toBe(6);
    expect(countActiveFilters(params, { includeCategory: false })).toBe(5);
  });
});
