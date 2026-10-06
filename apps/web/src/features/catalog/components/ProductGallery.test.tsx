import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ProductGallery } from './ProductGallery';

describe('ProductGallery', () => {
  it('shows every image as a thumbnail and switches the main image on click', async () => {
    const user = userEvent.setup();
    render(<ProductGallery title="Lamp" images={['a.webp', 'b.webp', 'c.webp']} />);

    expect(screen.getAllByRole('button', { name: /Show image/ })).toHaveLength(3);
    expect(screen.getByAltText('Lamp, image 1 of 3')).toHaveAttribute('src', 'a.webp');
    expect(screen.getByRole('button', { name: 'Show image 1 of 3' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Show image 3 of 3' }));
    expect(screen.getByAltText('Lamp, image 3 of 3')).toHaveAttribute('src', 'c.webp');
    expect(screen.getByRole('button', { name: 'Show image 3 of 3' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows no thumbnail strip for a single image', () => {
    render(<ProductGallery title="Lamp" images={['a.webp']} />);
    expect(screen.getByAltText('Lamp')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('moves with previous/next buttons and arrow keys, wrapping around', async () => {
    const user = userEvent.setup();
    render(<ProductGallery title="Lamp" images={['a.webp', 'b.webp', 'c.webp']} />);
    await user.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(screen.getByAltText('Lamp, image 3 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(screen.getByAltText('Lamp, image 1 of 3')).toBeInTheDocument();

    const gallery = screen.getByRole('group', { name: 'Lamp images' });
    fireEvent.keyDown(gallery, { key: 'ArrowRight' });
    expect(screen.getByAltText('Lamp, image 2 of 3')).toBeInTheDocument();
    fireEvent.keyDown(gallery, { key: 'ArrowLeft' });
    expect(screen.getByAltText('Lamp, image 1 of 3')).toBeInTheDocument();
  });
});
