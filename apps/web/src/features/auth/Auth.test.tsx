import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { addRecentSearch, recentSearchesStore, reloadRecentSearches } from '@/lib/recentSearches';
import { recentlyViewedStore, reloadRecentlyViewed } from '@/lib/recentlyViewed';
import { addUser, setMergeResult, syncRequests } from '@/test/authServer';
import { renderRoute } from '@/test/render';

const KARAN = { name: 'Karan Aneja', email: 'karan@example.com', mobile: '9876543210', password: 'correct horse battery' };

beforeEach(() => {
  localStorage.clear();
  reloadRecentSearches();
  reloadRecentlyViewed();
});

const accountMenu = () => screen.findByRole('button', { name: 'Account menu for Karan' });

/** Reads the demo code from the banner and types it. */
async function enterDemoCode(user: ReturnType<typeof userEvent.setup>) {
  const banner = await screen.findByText(/Demo SMS to/);
  const code = banner.parentElement!.textContent!.match(/\d{6}/)![0];
  await user.type(screen.getByLabelText('6-digit code'), code);
}

describe('sign-up', () => {
  it('goes from a product page to sign-up and back to the same page, signed in', async () => {
    const user = userEvent.setup();
    const { location } = renderRoute('/p/check-shirt?size=L');
    await screen.findByRole('heading', { level: 1, name: 'Check Shirt' });

    await user.click(await screen.findByRole('link', { name: 'Sign in' }));
    expect(location().pathname).toBe('/login');
    await user.click(screen.getByRole('link', { name: 'Create an account' }));
    expect(location().search).toContain('returnTo=%2Fp%2Fcheck-shirt%3Fsize%3DL');

    await user.type(screen.getByLabelText('Full name'), 'Karan Aneja');
    await user.type(screen.getByLabelText('Email'), 'karan@example.com');
    await user.type(screen.getByLabelText('Mobile number'), '+91 98765 43210');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Verify your mobile' })).toBeInTheDocument();
    expect(screen.getByText(/Demo SMS to ••••••3210/)).toBeInTheDocument();
    await enterDemoCode(user);

    await waitFor(() => expect(location().pathname + location().search).toBe('/p/check-shirt?size=L'));
    expect(await accountMenu()).toBeInTheDocument();
  });

  it('shows inline errors, focuses the first, and rejects common passwords', async () => {
    const user = userEvent.setup();
    renderRoute('/signup');
    await user.type(await screen.findByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'password');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Enter your name (2–60 characters)')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Enter a 10-digit Indian mobile number')).toBeInTheDocument();
    expect(screen.getByText('That password is too common')).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveFocus();
    expect(screen.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('points existing customers to sign in', async () => {
    addUser(KARAN);
    const user = userEvent.setup();
    renderRoute('/signup');
    await user.type(await screen.findByLabelText('Full name'), 'Karan');
    await user.type(screen.getByLabelText('Email'), KARAN.email);
    await user.type(screen.getByLabelText('Mobile number'), '9123456789');
    await user.type(screen.getByLabelText('Password'), 'another secret');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in instead' })).toBeInTheDocument();
  });
});

describe('sign-in', () => {
  it('signs in with mobile and code, showing attempts left after a wrong code', async () => {
    addUser(KARAN);
    const user = userEvent.setup();
    renderRoute('/login');
    await user.type(await screen.findByLabelText('Mobile number'), '98765 43210');
    await user.click(screen.getByRole('button', { name: 'Send code' }));

    await screen.findByText(/Demo SMS to/);
    await user.type(screen.getByLabelText('6-digit code'), '000000');
    expect(await screen.findByText("That code isn't right. 4 attempts left.")).toBeInTheDocument();
    await enterDemoCode(user);
    expect(await accountMenu()).toBeInTheDocument();
  });

  it('offers sign-up for an unknown number, keeping the number', async () => {
    const user = userEvent.setup();
    const { location } = renderRoute('/login');
    await user.type(await screen.findByLabelText('Mobile number'), '9000000000');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await user.click(await screen.findByRole('link', { name: 'Sign up?' }));
    expect(location().pathname).toBe('/signup');
    expect(screen.getByLabelText('Mobile number')).toHaveValue('9000000000');
  });

  it('signs in with a password, with one generic error for wrong details', async () => {
    addUser(KARAN);
    const user = userEvent.setup();
    renderRoute('/login');
    await user.click(await screen.findByRole('link', { name: 'Use password instead' }));
    await user.type(screen.getByLabelText('Email or mobile'), KARAN.email);
    await user.type(screen.getByLabelText('Password'), 'wrong password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Incorrect email/mobile or password.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), KARAN.password);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await accountMenu()).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderRoute('/login?method=password');
    const field = await screen.findByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field).toHaveAttribute('type', 'text');
  });

  it('ignores a returnTo that leaves the site', async () => {
    addUser(KARAN);
    const user = userEvent.setup();
    const { location } = renderRoute('/login?method=password&returnTo=%2F%2Fevil.example');
    await user.type(await screen.findByLabelText('Email or mobile'), KARAN.email);
    await user.type(screen.getByLabelText('Password'), KARAN.password);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(location().pathname).toBe('/'));
  });

  it('says what was kept from the guest session', async () => {
    addUser(KARAN);
    setMergeResult({ cart: true, wishlist: true });
    const user = userEvent.setup();
    renderRoute('/login?method=password');
    await user.type(await screen.findByLabelText('Email or mobile'), KARAN.email);
    await user.type(screen.getByLabelText('Password'), KARAN.password);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Welcome, Karan. We kept your cart and wishlist.')).toBeInTheDocument();
  });
});

describe('forgot password', () => {
  it('resets with a code and signs in', async () => {
    addUser(KARAN);
    const user = userEvent.setup();
    renderRoute('/forgot-password');
    await user.type(await screen.findByLabelText('Email or mobile'), KARAN.email);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await enterDemoCode(user);
    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('New password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Save and sign in' }));
    expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('New password'));
    await user.type(screen.getByLabelText('New password'), 'a brand new secret');
    await user.click(screen.getByRole('button', { name: 'Save and sign in' }));
    expect(await accountMenu()).toBeInTheDocument();
  });
});

describe('signed in', () => {
  it('signs out from the header menu, leaving a fresh guest with local history cleared', async () => {
    addUser(KARAN, { signedIn: true });
    addRecentSearch('laptop');
    const user = userEvent.setup();
    renderRoute('/products');
    await user.click(await accountMenu());
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    expect(await screen.findByText("You've signed out.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(recentSearchesStore.get()).toEqual([]);
  });

  it('syncs history with the account, then mirrors new searches', async () => {
    addUser(KARAN, { signedIn: true });
    recentlyViewedStore.add({ slug: 'product-1', viewedAt: '2026-10-01T10:00:00.000Z' });
    renderRoute('/products');
    await accountMenu();
    await waitFor(() => expect(syncRequests[0]?.recentlyViewed).toEqual([{ slug: 'product-1', viewedAt: '2026-10-01T10:00:00.000Z' }]));

    act(() => addRecentSearch('watch'));
    await waitFor(() => expect(syncRequests.at(-1)?.recentSearches.map((s) => s.query)).toEqual(['watch']));
  });

  it('shows account details, and sends guests to sign in first', async () => {
    const { unmount, location } = renderRoute('/account');
    await waitFor(() => expect(location().pathname).toBe('/login'));
    expect(location().search).toBe('?returnTo=%2Faccount');
    unmount();

    addUser(KARAN, { signedIn: true });
    renderRoute('/account');
    const details = await screen.findByRole('heading', { name: 'My account' });
    const page = details.parentElement!;
    expect(within(page).getByText('karan@example.com')).toBeInTheDocument();
    expect(within(page).getByText('••••••3210')).toBeInTheDocument();
  });
});
