import { screen } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { addUser } from '@/test/authServer';
import { renderRoute } from '@/test/render';
import { server } from '@/test/server';

const KARAN = { name: 'Karan Aneja', email: 'karan@example.com', mobile: '9876543210', password: 'correct horse battery' };

afterEach(() => onlineManager.setOnline(true));

describe('account pages when the sign-in check fails', () => {
  it.each(['/account', '/account/orders', '/account/addresses/new'])('%s says it could not load instead of asking a signed-in user to sign in', async (path) => {
    addUser(KARAN, { signedIn: true });
    server.use(http.get('*/api/auth/me', () => HttpResponse.json({ error: { code: 'INTERNAL', message: 'x' } }, { status: 500 })));
    const { location } = renderRoute(path);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(location().pathname).toBe(path);
  });
});

describe('pages opened offline', () => {
  it.each([
    ['/account', /load your account as soon as you're back online/],
    ['/account/orders', /load your orders as soon as you're back online/],
    ['/orders/ORD-ABCDEFGH/confirmation', /load your order as soon as you're back online/],
    ['/checkout/pay/ORD-ABCDEFGH', /load your order as soon as you're back online/],
  ])('%s shows the offline state, not an endless placeholder', async (path, message) => {
    addUser(KARAN, { signedIn: true });
    onlineManager.setOnline(false);
    renderRoute(path);
    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});
