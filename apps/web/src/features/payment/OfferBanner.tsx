import { BadgePercent } from 'lucide-react';
import { bestOfferFor, formatPrice, OFFERS } from '@store/shared';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

/**
 * The single best bank offer for one unit at this price (spec FR-4). Hidden when no offer gives
 * a real saving or the product can't be bought.
 */
export function OfferBanner({ pricePaise, outOfStock }: { pricePaise: number; outOfStock: boolean }) {
  const best = bestOfferFor(pricePaise);
  if (!best || outOfStock) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <BadgePercent className="size-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
      <span>
        Save <span className="font-semibold">{formatPrice(best.discountPaise)}</span> with {best.offer.cardsLabel}
      </span>
      <OffersPanel />
    </div>
  );
}

export function OffersPanel() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="link" className="h-auto px-0 text-sm">
          All offers
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Bank offers</SheetTitle>
          <SheetDescription>
            Demo offers from fictional banks. Choose one at payment; it applies to the full order total (including delivery), one offer per order.
          </SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-3 px-4 pb-4">
          {OFFERS.map((offer) => (
            <li key={offer.id} className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{offer.bankName}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Demo offer</span>
              </span>
              <span>{offer.headline}</span>
              <span className="text-muted-foreground">
                {offer.cardsLabel} · min. order {formatPrice(offer.minOrderPaise)} · max. discount {formatPrice(offer.maxDiscountPaise)}
              </span>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
