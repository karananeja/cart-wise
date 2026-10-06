import { ChevronDown, ShoppingBag } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCategories } from '@/features/catalog/api';
import { SearchBox } from '@/features/search/SearchBox';
import { STORE_NAME } from './store';

export function Header() {
  const categories = useCategories();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      {/* One search box for all widths: CSS order puts it inline on desktop and in its own row on mobile. */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-2 sm:gap-x-6 sm:px-6 md:flex-nowrap lg:px-8">
        <Link to="/" className="order-1 flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <ShoppingBag className="size-5" aria-hidden />
          {STORE_NAME}
        </Link>
        <SearchBox className="order-3 w-full md:order-2 md:mx-auto md:w-auto md:max-w-xl md:flex-1" />
        <nav aria-label="Main" className="order-2 ml-auto flex items-center gap-1 md:order-3 md:ml-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost">
                Categories <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[70dvh] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto">
              <DropdownMenuLabel>Shop by category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {categories.data ? (
                <div className="grid grid-cols-2">
                  {categories.data.map((c) => (
                    <DropdownMenuItem key={c.slug} asChild>
                      <Link to={`/c/${c.slug}`}>{c.name}</Link>
                    </DropdownMenuItem>
                  ))}
                </div>
              ) : (
                <DropdownMenuItem disabled>{categories.isError ? "Categories couldn't load" : 'Loading…'}</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild variant="ghost">
            <NavLink to="/products" end className="aria-[current=page]:bg-muted">
              All products
            </NavLink>
          </Button>
        </nav>
      </div>
    </header>
  );
}
