import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from '@/lib/analytics';
import { apiSend } from '@/lib/api';
import { recentlyViewedStore, reloadRecentlyViewed } from '@/lib/recentlyViewed';
import { addUser } from '@/test/authServer';
import { setStock, view } from '@/test/cartServer';
import {
  failRecommendations,
  homeRequests,
  recommended,
  setCartRecommendations,
  setHomeRecommendations,
  setProductRecommendations,
} from '@/test/discoveryServer';
import { productDetails, products, shirt } from '@/test/fixtures';
import { renderRoute } from '@/test/render';
import { receivedEvents } from '@/test/server';

const bySlug = (slug: string) => productDetails.find((p) => p.slug === slug)!;
const cable = recommended(bySlug('usb-cable'));
const pCase = recommended(bySlug('phone-case'));
const sizedShirt = recommended(shirt, true);
const KARAN = { name: 'Karan Aneja', email: 'karan@example.com', mobile: '9876543210', password: 'correct horse battery' };

beforeEach(async () => {
  localStorage.clear();
  reloadRecentlyViewed();
  flush();
  await new Promise((resolve) => setTimeout(resolve, 20));
  receivedEvents.length = 0;
});

const events = async (name: string) => {
  flush();
  await new Promise((resolve) => setTimeout(resolve, 20));
  return receivedEvents.filter((e) => e.name === name).map((e) => e.properties);
};

describe('product page pairing', () => {
  it('shows "Pairs well with", adds the ticked items in one tap, and records the recommendation', async () => {
    setProductRecommendations('product-4', { pairing: { kind: 'pairs_well', items: [cable, pCase] }, similar: [] });
    const user = userEvent.setup();
    renderRoute('/p/product-4');

    const section = await screen.findByRole('region', { name: 'Pairs well with' });
    expect(within(section).getByRole('checkbox', { name: 'Include USB Cable' })).toBeChecked();
    expect(within(section).getByText('₹92,000')).toBeInTheDocument();
    await user.click(within(section).getByRole('checkbox', { name: 'Include Phone Case' }));
    expect(within(section).getByText('₹91,200')).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: 'Add both to cart' }));
    expect(await within(section).findByText('Added 2 items to your cart')).toBeInTheDocument();
    expect(view().lines.map((l) => l.product.slug).sort()).toEqual(['product-4', 'usb-cable']);

    expect(await events('recommendation_clicked')).toEqual([{ surface: 'product', kind: 'pairs_well', productId: 60, position: 1 }]);
    expect((await events('cart_item_added')).map((p) => p.source)).toEqual(['recommendation', 'recommendation']);
  });

  it('offers no second "Add to cart" when no companion is ticked', async () => {
    setProductRecommendations('product-4', { pairing: { kind: 'pairs_well', items: [cable] }, similar: [] });
    const user = userEvent.setup();
    renderRoute('/p/product-4');
    const section = await screen.findByRole('region', { name: 'Pairs well with' });
    await user.click(within(section).getByRole('checkbox', { name: 'Include USB Cable' }));
    expect(within(section).queryByRole('button')).not.toBeInTheDocument();
    expect(within(section).getByText('Tick an item to add them together.')).toBeInTheDocument();
    // The page keeps exactly one Add to cart.
    expect(screen.getAllByRole('button', { name: 'Add to cart' })).toHaveLength(1);
  });

  it('labels real co-purchases, links sized companions to their page, and reports partial failures', async () => {
    setProductRecommendations('product-4', { pairing: { kind: 'bought_together', items: [pCase, sizedShirt] }, similar: [] });
    setStock('phone-case', null, 0);
    const user = userEvent.setup();
    renderRoute('/p/product-4');

    const section = await screen.findByRole('region', { name: 'Frequently bought together' });
    expect(within(section).queryByRole('checkbox', { name: 'Include Check Shirt' })).not.toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Choose size' })).toHaveAttribute('href', '/p/check-shirt');

    await user.click(within(section).getByRole('button', { name: 'Add both to cart' }));
    expect(await within(section).findByText("Added iPhone; couldn't add Phone Case (sorry, this just sold out)")).toBeInTheDocument();
    expect(view().lines.map((l) => l.product.slug)).toEqual(['product-4']);
  });

  it('waits for a size when the page product has sizes', async () => {
    setProductRecommendations('check-shirt', { pairing: { kind: 'pairs_well', items: [cable] }, similar: [] });
    const { unmount } = renderRoute('/p/check-shirt');
    let section = await screen.findByRole('region', { name: 'Pairs well with' });
    expect(within(section).getByRole('button', { name: 'Add both to cart' })).toBeDisabled();
    expect(within(section).getByText('Choose a size above first')).toBeInTheDocument();
    unmount();

    renderRoute('/p/check-shirt?size=L');
    section = await screen.findByRole('region', { name: 'Pairs well with' });
    expect(within(section).getByRole('button', { name: 'Add both to cart' })).toBeEnabled();
  });

  it('shows "You may also like" and records which suggestion was opened', async () => {
    setProductRecommendations('product-1', { pairing: null, similar: [recommended(products[1]!), recommended(products[2]!)] });
    const user = userEvent.setup();
    const { location } = renderRoute('/p/product-1');
    const rail = await screen.findByRole('region', { name: 'You may also like' });
    expect(screen.queryByRole('region', { name: 'Pairs well with' })).not.toBeInTheDocument();
    await user.click(await within(rail).findByRole('link', { name: 'XPS 13' }));
    await waitFor(() => expect(location().pathname).toBe('/p/product-3'));
    expect(await events('recommendation_clicked')).toEqual([{ surface: 'product', kind: 'similar', productId: 3, position: 2 }]);
  });

  it('leaves the sections out when suggestions fail, keeping the product page intact', async () => {
    failRecommendations();
    renderRoute('/p/product-4');
    expect(await screen.findByRole('heading', { level: 1, name: 'iPhone' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading product' })).not.toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('region', { name: 'You may also like' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Pairs well with|Frequently bought together/ })).not.toBeInTheDocument();
  });
});

describe('homepage continue shopping', () => {
  it('shows nothing extra to a first-time visitor', async () => {
    renderRoute('/');
    expect(await screen.findByRole('heading', { level: 2, name: 'Shop by category' })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(homeRequests).toEqual([]);
    expect(screen.queryByRole('region', { name: 'Still in your cart' })).not.toBeInTheDocument();
  });

  it('shows the cart reminder and "Because you viewed" for a returning visitor', async () => {
    recentlyViewedStore.add({ slug: 'product-1', viewedAt: '2026-10-06T10:00:00.000Z' });
    await apiSend('POST', '/cart/lines', { productSlug: 'usb-cable', quantity: 2 });
    setHomeRecommendations({ becauseViewed: { anchor: { slug: 'product-1', title: 'MacBook Pro' }, items: [recommended(products[1]!)] }, becauseBought: null });
    renderRoute('/');

    const reminder = await screen.findByRole('region', { name: 'Still in your cart' });
    expect(reminder).toHaveTextContent('2 items');
    expect(within(reminder).getByRole('link', { name: 'Go to cart' })).toHaveAttribute('href', '/cart');
    const rail = await screen.findByRole('region', { name: 'Because you viewed MacBook Pro' });
    expect(await within(rail).findByRole('link', { name: 'Zenbook' })).toBeInTheDocument();
    expect(homeRequests[0]).toBe('product-1');

    // Order on the page (user feedback): cart reminder, categories, Top rated, Biggest discounts,
    // then the history-based sections.
    const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const order = [
      reminder,
      await screen.findByRole('heading', { name: 'Shop by category' }),
      await screen.findByRole('heading', { name: 'Top rated' }),
      await screen.findByRole('heading', { name: 'Biggest discounts' }),
      rail,
    ];
    order.slice(1).forEach((el, i) => expect(follows(order[i]!, el)).toBe(true));
  });

  it('adds "Because you bought" for signed-in customers with orders', async () => {
    addUser(KARAN, { signedIn: true });
    setHomeRecommendations({ becauseViewed: null, becauseBought: { anchor: { slug: 'product-4', title: 'iPhone' }, items: [pCase] } });
    renderRoute('/');
    const rail = await screen.findByRole('region', { name: 'Because you bought iPhone' });
    expect(await within(rail).findByRole('link', { name: 'Phone Case' })).toBeInTheDocument();
  });
});

describe('cart suggestions', () => {
  it('puts "Pairs well with your cart" after the checkout action, and hides it for an empty cart', async () => {
    setCartRecommendations({ items: [pCase] });
    const { unmount } = renderRoute('/cart');
    expect(await screen.findByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Pairs well with your cart' })).not.toBeInTheDocument();
    unmount();

    await apiSend('POST', '/cart/lines', { productSlug: 'product-4' });
    renderRoute('/cart');
    const rail = await screen.findByRole('region', { name: 'Pairs well with your cart' });
    const checkout = screen.getAllByRole('link', { name: 'Proceed to checkout' })[0]!;
    // The rail comes after the checkout action in the page order.
    expect(checkout.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await within(rail).findByRole('link', { name: 'Phone Case' })).toBeInTheDocument();
  });
});
