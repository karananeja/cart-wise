import { Outlet, ScrollRestoration } from 'react-router';
import { AuthNotice } from '@/features/auth/AuthNotice';
import { HistorySync } from '@/features/auth/HistorySync';
import { Footer } from './Footer';
import { Header } from './Header';
import { OfflineBanner } from './OfflineBanner';

export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Header />
      <OfflineBanner />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <AuthNotice />
        <Outlet />
      </main>
      <Footer />
      <HistorySync />
      {/* Keyed by path: filter and sort changes keep the scroll position; new pages start at the top. */}
      <ScrollRestoration getKey={(location) => location.pathname} />
    </div>
  );
}
