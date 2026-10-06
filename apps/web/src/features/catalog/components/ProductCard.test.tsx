import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { ProductSummary } from '@store/shared';
import { product } from '@/test/fixtures';
import { ProductCard } from './ProductCard';

const renderCard = (p: ProductSummary) =>
  render(
    <MemoryRouter>
      <ProductCard product={p} />
    </MemoryRouter>,
  );

describe('ProductCard', () => {
  it('links to the product and shows brand, rating and discounted price', () => {
    renderCard(product({ id: 7, slug: 'macbook', title: 'MacBook Pro', mrpPaise: 1_999_99, pricePaise: 1_906_19, discountPercent: 5 }));
    expect(screen.getByRole('link', { name: 'MacBook Pro' })).toHaveAttribute('href', '/p/macbook');
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByLabelText('Rated 4.2 out of 5')).toBeInTheDocument();
    expect(screen.getByText('₹1,906.19')).toBeInTheDocument();
    expect(screen.getByText('₹1,999.99').closest('s')).not.toBeNull();
    expect(screen.getByText('5% off')).toBeInTheDocument();
  });

  it('hides the original price when there is no discount', () => {
    renderCard(product({ id: 1, mrpPaise: 50000, pricePaise: 50000, discountPercent: 0 }));
    expect(screen.getByText('₹500')).toBeInTheDocument();
    expect(screen.queryByText(/% off/)).not.toBeInTheDocument();
  });

  it('shows "Only N left" for low stock and nothing for normal stock', () => {
    const { unmount } = renderCard(product({ id: 1, availability: { status: 'low_stock', available: 3 } }));
    expect(screen.getByText('Only 3 left')).toBeInTheDocument();
    unmount();
    renderCard(product({ id: 2 }));
    expect(screen.queryByText(/left|Out of stock/)).not.toBeInTheDocument();
  });

  it('marks out-of-stock products', () => {
    renderCard(product({ id: 1, availability: { status: 'out_of_stock' } }));
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
  });

  it('falls back to a placeholder when the image fails', () => {
    const { container } = renderCard(product({ id: 1 }));
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
