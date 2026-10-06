import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProductImage } from './ProductImage';

const SWIPE_THRESHOLD_PX = 40;

/**
 * Main image with thumbnails, previous/next buttons, ←/→ keys when focused, and swipe on
 * touch screens. Controls appear only when there is more than one image.
 */
export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [selected, setSelected] = useState(0);
  const swipeStart = useRef<number | null>(null);
  const count = images.length;
  const current = images[selected] ?? images[0];
  if (!current) return null;

  const show = (index: number) => setSelected((index + count) % count);

  const onKeyDown = (event: KeyboardEvent) => {
    if (count < 2) return;
    if (event.key === 'ArrowLeft') show(selected - 1);
    else if (event.key === 'ArrowRight') show(selected + 1);
    else return;
    event.preventDefault();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'touch') swipeStart.current = event.clientX;
  };
  const onPointerUp = (event: PointerEvent) => {
    if (swipeStart.current === null) return;
    const delta = event.clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) show(selected + (delta < 0 ? 1 : -1));
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-roledescription="image gallery"
        aria-label={`${title} images`}
        tabIndex={count > 1 ? 0 : undefined}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipeStart.current = null)}
        className="relative touch-pan-y rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ProductImage key={current} src={current} alt={count > 1 ? `${title}, image ${selected + 1} of ${count}` : title} eager />
        {count > 1 && (
          <>
            <Button variant="outline" size="icon" className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-background/80" aria-label="Previous image" onClick={() => show(selected - 1)}>
              <ChevronLeft aria-hidden />
            </Button>
            <Button variant="outline" size="icon" className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-background/80" aria-label="Next image" onClick={() => show(selected + 1)}>
              <ChevronRight aria-hidden />
            </Button>
          </>
        )}
      </div>
      {count > 1 && (
        <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6" aria-label="Product images">
          {images.map((src, index) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-label={`Show image ${index + 1} of ${count}`}
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
