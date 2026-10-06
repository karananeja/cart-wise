import { Info } from 'lucide-react';
import { STORE_NAME } from './store';

export function Footer() {
  return (
    <footer className="mt-16 border-t bg-muted/40">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong className="font-medium text-foreground">Demo store.</strong> Products, ratings, reviews, stock levels and payments are simulated. No real
            orders are placed and no money is charged.
          </span>
        </p>
        <p>© {STORE_NAME} demo</p>
      </div>
    </footer>
  );
}
