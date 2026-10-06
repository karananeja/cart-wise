import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}

/** Square product image with a reserved box (no layout shift) and a placeholder on failure. */
export function ProductImage({ src, alt, className, eager = false }: ProductImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');

  return (
    <div className={cn('relative aspect-square overflow-hidden rounded-xl bg-muted', className)}>
      {status === 'failed' ? (
        <div role="img" aria-label={alt} className="flex size-full items-center justify-center text-muted-foreground">
          <ImageOff className="size-8" aria-hidden />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          width={400}
          height={400}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('failed')}
          className={cn(
            'size-full object-contain p-4 mix-blend-multiply transition-opacity duration-300',
            status === 'loaded' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  );
}
