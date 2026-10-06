import { Star } from 'lucide-react';

function reviewsLabel(count: number) {
  return `${count} ${count === 1 ? 'review' : 'reviews'}`;
}

/** Star value, optionally with the review count it is based on. */
export function Rating({ value, count }: { value: number; count?: number }) {
  const label = `Rated ${value.toFixed(1)} out of 5${count !== undefined ? ` from ${reviewsLabel(count)}` : ''}`;
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={label} role="img">
      <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
      <span aria-hidden className="tabular-nums">
        {value.toFixed(1)}
      </span>
      {count !== undefined && (
        <span aria-hidden className="text-muted-foreground tabular-nums">
          ({count})
        </span>
      )}
    </span>
  );
}

/** Five stars, filled to the rating, for the reviews section. */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${className ?? ''}`} aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`size-4 ${n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`} />
      ))}
    </span>
  );
}

export { reviewsLabel };
