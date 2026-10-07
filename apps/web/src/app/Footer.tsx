import type { ReactNode } from 'react';
import { ChevronDown, FlaskConical, Info } from 'lucide-react';
import { Link } from 'react-router';
import type { Category } from '@store/shared';
import { useCategories } from '@/features/catalog/api';
import { HELP_TOPICS } from '@/features/help/HelpLayout';
import { NewsletterForm } from '@/features/newsletter/NewsletterForm';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { STORE_NAME } from './store';

const SHOP_CATEGORY_COUNT = 6;

const ACCOUNT_LINKS = [
  { to: '/account', label: 'Account' },
  { to: '/account/orders', label: 'Orders' },
  { to: '/wishlist', label: 'Wishlist' },
  { to: '/cart', label: 'Cart' },
  { to: '/account/addresses', label: 'Addresses' },
];

/** The categories with the most products, largest first (ties by name). */
export function topCategories(categories: Category[], count = SHOP_CATEGORY_COUNT): Category[] {
  return [...categories].sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name)).slice(0, count);
}

/**
 * The store footer (F-018): brand, shop, account and help links, the newsletter, and the demo
 * notice. Under `sm` the link columns are collapsible sections; wider screens show them all.
 */
export function Footer() {
  const categories = useCategories();
  const shop = [
    ...(categories.data ? topCategories(categories.data).map((c) => ({ to: `/c/${c.slug}`, label: c.name })) : []),
    { to: '/products', label: 'All products' },
  ];

  return (
    <footer className="mt-16 border-t bg-muted/40 text-sm">
      <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-6 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.5fr] lg:px-8">
        <BrandColumn />
        {/* Mobile: the link columns stack as one bordered list of collapsible sections. */}
        <div className="flex flex-col divide-y border-y sm:contents sm:divide-y-0 sm:border-0">
          <LinkColumn title="Shop" links={shop} />
          <LinkColumn title="Your account" links={ACCOUNT_LINKS} />
          <LinkColumn title="Help" links={HELP_TOPICS} />
        </div>
        <section aria-labelledby="footer-newsletter" className="flex flex-col gap-2 sm:col-span-3 lg:col-span-1">
          <h2 id="footer-newsletter" className="font-semibold text-foreground">
            Newsletter
          </h2>
          <NewsletterForm />
        </section>
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-muted-foreground sm:px-6 lg:px-8">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong className="font-medium text-foreground">Demo store.</strong> Products, ratings, reviews, stock levels and payments are simulated. No real
              orders are placed and no money is charged.
            </span>
          </p>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p>
              © {new Date().getFullYear()} {STORE_NAME} demo
            </p>
            <Link to="/sim" className="inline-flex items-center gap-1.5 underline-offset-4 hover:text-foreground hover:underline">
              <FlaskConical className="size-4" aria-hidden />
              Store simulation <span className="text-xs">(demo operator)</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function BrandColumn() {
  return (
    <div className="flex flex-col gap-4 sm:col-span-3 lg:col-span-1">
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold tracking-tight text-foreground">{STORE_NAME}</p>
        <p className="text-muted-foreground">Everyday finds, delivered across India.</p>
      </div>
      {/* Decorative only (FR-4): not links or buttons, so nothing leads to a fake page. */}
      <div role="group" aria-labelledby="footer-social" className="flex flex-col gap-2 text-muted-foreground/80">
        <p id="footer-social" className="text-xs">
          Follow us · coming soon
        </p>
        <ul className="flex gap-3">
          {SOCIAL.map(({ name, icon }) => (
            <li key={name} className="flex size-8 items-center justify-center rounded-full border bg-background/60">
              {icon}
              <span className="sr-only">{name}</span>
            </li>
          ))}
        </ul>
      </div>
      <div role="group" aria-labelledby="footer-apps" className="flex flex-col gap-2 text-muted-foreground/80">
        <p id="footer-apps" className="text-xs">
          Get the app · coming soon
        </p>
        <ul className="flex flex-wrap gap-2">
          <AppBadge glyph={<AppleGlyph />} small="Download on the" name="App Store" />
          <AppBadge glyph={<PlayGlyph />} small="Get it on" name="Google Play" />
        </ul>
      </div>
    </div>
  );
}

/** A column of links: headed and always visible from `sm`, a native collapsible section below it. */
function LinkColumn({ title, links }: { title: string; links: readonly { to: string; label: string }[] }) {
  const wide = useMediaQuery('(min-width: 640px)');
  const list = (
    <ul className="flex flex-col gap-2.5 text-muted-foreground max-sm:pb-4">
      {links.map((link) => (
        <li key={link.to}>
          <Link to={link.to} className="underline-offset-4 hover:text-foreground hover:underline">
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
  if (wide) {
    return (
      <nav aria-label={title} className="flex flex-col gap-3">
        <h2 className="font-semibold text-foreground">{title}</h2>
        {list}
      </nav>
    );
  }
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between py-3 [&::-webkit-details-marker]:hidden">
        <h2 className="font-semibold text-foreground">{title}</h2>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <nav aria-label={title}>{list}</nav>
    </details>
  );
}

function AppBadge({ glyph, small, name }: { glyph: ReactNode; small: string; name: string }) {
  return (
    <li className="flex h-10 items-center gap-2 rounded-lg border bg-background/60 px-3">
      {glyph}
      <span className="flex flex-col leading-tight">
        <span className="text-[10px]" aria-hidden>
          {small}
        </span>
        <span className="text-sm font-medium">{name}</span>
      </span>
    </li>
  );
}

// Simple recognisable glyphs drawn here (lucide has no brand icons). Hidden from screen readers;
// each item's name is read instead.
const svg = { viewBox: '0 0 24 24', className: 'size-4', 'aria-hidden': true, focusable: false } as const;

const SOCIAL = [
  {
    name: 'Instagram',
    icon: (
      <svg {...svg} fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: 'X',
    icon: (
      <svg {...svg} fill="currentColor">
        <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
      </svg>
    ),
  },
  {
    name: 'YouTube',
    icon: (
      <svg {...svg} fill="currentColor">
        <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
      </svg>
    ),
  },
  {
    name: 'Facebook',
    icon: (
      <svg {...svg} fill="currentColor">
        <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3Z" />
      </svg>
    ),
  },
];

function AppleGlyph() {
  return (
    <svg {...svg} className="size-5" fill="currentColor">
      <path d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.9-.8-3-.8-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.2.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.5 1.3-2.6 0 0-2.5-1-2.5-3.6ZM14.1 5.5c.6-.8 1.1-1.8 1-2.9-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.8 1 .1 2.1-.5 2.7-1.3Z" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg {...svg} className="size-5" fill="currentColor">
      <path d="M4 2.8v18.4c0 .5.6.9 1.1.6l15.4-8.9a.9.9 0 0 0 0-1.6L5.1 2.2c-.5-.3-1.1 0-1.1.6Z" />
    </svg>
  );
}
