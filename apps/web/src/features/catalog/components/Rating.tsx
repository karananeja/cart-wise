import { Star } from 'lucide-react';

export function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
      <span aria-hidden className="tabular-nums">
        {value.toFixed(1)}
      </span>
    </span>
  );
}
