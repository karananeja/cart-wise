import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ProductImage } from './ProductImage';

/** Main image plus a thumbnail strip; thumbnails only appear when there is more than one image. */
export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [selected, setSelected] = useState(0);
  const current = images[selected] ?? images[0];
  if (!current) return null;

  return (
    <div className="flex flex-col gap-3">
      <ProductImage key={current} src={current} alt={images.length > 1 ? `${title}, image ${selected + 1} of ${images.length}` : title} eager />
      {images.length > 1 && (
        <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6" aria-label="Product images">
          {images.map((src, index) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-label={`Show image ${index + 1} of ${images.length}`}
                aria-pressed={index === selected}
                className={cn(
                  'block w-full cursor-pointer rounded-lg ring-offset-2 ring-offset-background transition outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  index === selected ? 'ring-2 ring-foreground' : 'opacity-70 hover:opacity-100',
                )}
              >
                <ProductImage key={src} src={src} alt="" className="rounded-lg [&_img]:p-1.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
