import type { ProductReview } from '@store/shared';
import { reviewsLabel, Stars } from './Rating';

/** Imported reviews, unlabelled (Q5); the rating shown is their average (Q15). */
export function ReviewList({ reviews, rating }: { reviews: ProductReview[]; rating: number }) {
  return (
    <section aria-labelledby="reviews-heading" id="reviews" className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="reviews-heading" className="text-xl font-semibold tracking-tight">
          Customer reviews
        </h2>
        {reviews.length > 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Stars value={rating} />
            <span>
              {rating.toFixed(1)} out of 5 · {reviewsLabel(reviews.length)}
            </span>
          </p>
        )}
      </div>
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review, index) => (
            <li key={index} className="flex flex-col gap-2 rounded-xl border p-4">
              <span className="flex items-center gap-2">
                <Stars value={review.rating} />
                <span className="sr-only">Rated {review.rating} out of 5</span>
              </span>
              <p className="text-sm">{review.comment}</p>
              <p className="mt-auto text-xs text-muted-foreground">{review.reviewerName}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
