import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addRecentSearch, recentSearchesStore, reloadRecentSearches, removeRecentSearch } from '@/lib/recentSearches';
import { recentlyViewedStore, reloadRecentlyViewed } from '@/lib/recentlyViewed';
import { addUser, historyRemovals, lastEmailedCode, setEmailDelivery, setMergeResult, syncRequests } from '@/test/authServer';
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
  const banner = await screen.findByText(/Demo email to/);
  const code = banner.parentElement!.textContent!.match(/\d{6}/)![0];
  await user.type(screen.getByLabelText('6-digit code'), code);
}

describe('sign-up', () => {
  it('goes from a product page to sign-up and back to the same page, signed in', async () => {
    const user = userEvent.setup();
    const { location } = renderRoute('/p/check-shirt?size=L');
    await screen.findByRole('heading', { level: 1, name: 'Check Shirt' });

    await user.click(await screen.findByRole('link', { name: 'Sign in' }));
    // Pages load on first visit, so wait for each one.
    await user.click(await screen.findByRole('link', { name: 'Create an account' }));
    expect(location().pathname).not.toBe('/p/check-shirt');
    await user.type(await screen.findByLabelText('Full name'), 'Karan Aneja');
    expect(location().pathname).toBe('/signup');
    expect(location().search).toContain('returnTo=%2Fp%2Fcheck-shirt%3Fsize%3DL');
    await user.type(screen.getByLabelText('Email'), 'karan@example.com');
    await user.type(screen.getByLabelText('Mobile number (optional)'), '+91 98765 43210');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Verify your email' })).toBeInTheDocument();
    expect(screen.getByText(/Demo email to k••••@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/No real email is sent/)).toBeInTheDocument();
    await enterDemoCode(user);

    await waitFor(() => expect(location().pathname + location().search).toBe('/p/check-shirt?size=L'));
    expect(await accountMenu()).toBeInTheDocument();
  });

  it('shows inline errors, focuses the first, and rejects common passwords', async () => {
    const user = userEvent.setup();
    renderRoute('/signup');
    await user.type(await screen.findByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'password');
    await user.type(screen.getByLabelText('Mobile number (optional)'), '12345');
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
    await user.type(screen.getByLabelText('Password'), 'another secret');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in instead' })).toBeInTheDocument();
  });
});

describe('sign-in', () => {
  it('signs in with email and code, showing attempts left after a wrong code', async () => {
    addUser(KARAN);
    const user = userEvent.setup();
    renderRoute('/login');
    expect(await screen.findByText("We'll email you a one-time code.")).toBeInTheDocument();
    await user.type(await screen.findByLabelText('Email'), 'Karan@Example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));

    await screen.findByText(/Demo email to k••••@example.com/);
    await user.type(screen.getByLabelText('6-digit code'), '000000');
    expect(await screen.findByText("That code isn't right. 4 attempts left.")).toBeInTheDocument();
    await enterDemoCode(user);
    expect(await accountMenu()).toBeInTheDocument();
  });

  it('offers sign-up for an unknown email, keeping the email', async () => {
    const user = userEvent.setup();
    const { location } = renderRoute('/login');
    await user.type(await screen.findByLabelText('Email'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText(/No account for this email/)).toBeInTheDocument();
    await user.click(await screen.findByRole('link', { name: 'Sign up?' }));
    // Sign-up loads on first visit, so wait for its form.
    expect(await screen.findByLabelText('Full name')).toBeInTheDocument();
    expect(location().pathname).toBe('/signup');
    expect(screen.getByLabelText('Email')).toHaveValue('new@example.com');
  });

  it('checks the email before sending a code', async () => {
    const user = userEvent.setup();
    renderRoute('/login');
    await user.type(await screen.findByLabelText('Email'), '98765 43210');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('signs in with a password, with one generic error for wrong details', async () => {
    addUser(KARAN);
    const user = userEvent.setup();
    renderRoute('/login');
    await user.click(await screen.findByRole('link', { name: 'Use password instead' }));
    await user.type(screen.getByLabelText('Email'), KARAN.email);
    await user.type(screen.getByLabelText('Password'), 'wrong password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();

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
    await user.type(await screen.findByLabelText('Email'), KARAN.email);
    await user.type(screen.getByLabelText('Password'), KARAN.password);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(location().pathname).toBe('/'));
  });

  it('says what was kept from the guest session', async () => {
    addUser(KARAN);
    setMergeResult({ cart: true, wishlist: true });
    const user = userEvent.setup();
    renderRoute('/login?method=password');
    await user.type(await screen.findByLabelText('Email'), KARAN.email);
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
    await user.type(await screen.findByLabelText('Email'), KARAN.email);
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
    // Signing out empties this device only; the account keeps its history.
    expect(historyRemovals).toEqual([]);
  });

  it('syncs history with the account, then mirrors new searches', async () => {
    addUser(KARAN, { signedIn: true });
    recentlyViewedStore.add({ slug: 'product-1', viewedAt: '2026-10-01T10:00:00.000Z' });
    renderRoute('/products');
    await accountMenu();
    await waitFor(() => expect(syncRequests[0]?.recentlyViewed).toEqual([{ slug: 'product-1', viewedAt: '2026-10-01T10:00:00.000Z' }]));

    act(() => addRecentSearch('watch'));
    await waitFor(() => expect(syncRequests.at(-1)?.recentSearches.map((s) => s.query)).toEqual(['watch']));

    // Removals reach the account too, so the next merge can't bring them back.
    act(() => removeRecentSearch('Watch'));
    act(() => recentlyViewedStore.clear());
    // Sent independently, so they may arrive in either order.
    await waitFor(() => expect(historyRemovals).toHaveLength(2));
    expect(historyRemovals).toEqual(expect.arrayContaining([{ list: 'recentSearches', key: 'watch' }, { list: 'recentlyViewed' }]));
  });
});

describe('real email (SMTP configured, F-016)', () => {
  beforeEach(() => setEmailDelivery());
  afterEach(() => vi.useRealTimers());

  it('signs up without a mobile: says the code was emailed, shows no code, and hints at spam after 30 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderRoute('/signup');
    await user.type(await screen.findByLabelText('Full name'), 'Karan Aneja');
    await user.type(screen.getByLabelText('Email'), 'karan@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText(/We emailed a code to/)).toHaveTextContent('We emailed a code to k••••@example.com.');
    expect(screen.queryByText(/Demo email to/)).not.toBeInTheDocument();
    expect(screen.queryByText(/spam/)).not.toBeInTheDocument();
    for (let i = 0; i < 30; i++) act(() => vi.advanceTimersByTime(1000));
    expect(await screen.findByText('Check your spam folder.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('6-digit code'), lastEmailedCode()!);
    expect(await accountMenu()).toBeInTheDocument();
  });

  it('resets a password with an emailed code', async () => {
    addUser(KARAN);
    const user = userEvent.setup();
    renderRoute('/forgot-password');
    await user.type(await screen.findByLabelText('Email'), KARAN.email);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText(/We emailed a code to/)).toHaveTextContent('k••••@example.com');
    await user.type(screen.getByLabelText('6-digit code'), lastEmailedCode()!);
    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument();
  });

  it('says when the email could not be sent, so the shopper can try again', async () => {
    addUser(KARAN);
    setEmailDelivery({ failing: true });
    const user = userEvent.setup();
    renderRoute('/login');
    await user.type(await screen.findByLabelText('Email'), KARAN.email);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't send the code. Please try again.");

    setEmailDelivery();
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText(/We emailed a code to/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('6-digit code'), lastEmailedCode()!);
    expect(await accountMenu()).toBeInTheDocument();
  });
});
