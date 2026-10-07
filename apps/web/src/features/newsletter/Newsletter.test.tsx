import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from '@/lib/analytics';
import { addSubscriber, subscribers } from '@/test/newsletterServer';
import { renderRoute } from '@/test/render';
import { receivedEvents, server } from '@/test/server';

beforeEach(async () => {
  flush();
  await new Promise((resolve) => setTimeout(resolve, 20));
  receivedEvents.length = 0;
});

async function subscribe(email: string) {
  const user = userEvent.setup();
  renderRoute('/');
  const footer = screen.getByRole('contentinfo');
  const input = within(footer).getByRole('textbox', { name: 'Email for the newsletter' });
  if (email) await user.type(input, email);
  await user.click(within(footer).getByRole('button', { name: 'Subscribe' }));
  return { user, footer, input };
}

describe('newsletter form (F-018)', () => {
  it('subscribes, says so politely and records the event without the email', async () => {
    const { footer } = await subscribe('Karan@Example.com');
    expect(await within(footer).findByRole('status')).toHaveTextContent("You're subscribed. Thanks!");
    expect(within(footer).queryByRole('textbox', { name: 'Email for the newsletter' })).not.toBeInTheDocument();
    expect(subscribers.get('karan@example.com')?.active).toBe(true);

    flush();
    await waitFor(() => expect(receivedEvents.find((e) => e.name === 'newsletter_subscribed')?.properties).toEqual({ source: 'footer' }));
    expect(JSON.stringify(receivedEvents)).not.toContain('example.com');
  });

  it('shows the same success for an address that is already subscribed', async () => {
    addSubscriber('karan@example.com', 'token-x');
    const { footer } = await subscribe('karan@example.com');
    expect(await within(footer).findByRole('status')).toHaveTextContent("You're subscribed. Thanks!");
  });

  it('shows an inline error for an invalid email without sending it', async () => {
    const { footer, input } = await subscribe('not-an-email');
    expect(within(footer).getByText('Enter a valid email address')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(subscribers.size).toBe(0);
  });

  it('shows a spinner and disables Subscribe while sending', async () => {
    server.use(
      http.post('*/api/newsletter', async () => {
        await delay(150);
        return HttpResponse.json({ ok: true });
      }),
    );
    const { footer } = await subscribe('karan@example.com');
    expect(within(footer).getByRole('button', { name: 'Subscribe' })).toBeDisabled();
    expect(await within(footer).findByText("You're subscribed. Thanks!")).toBeInTheDocument();
  });

  it('says when there have been too many sign-ups', async () => {
    server.use(http.post('*/api/newsletter', () => HttpResponse.json({ error: { code: 'TOO_MANY_REQUESTS', message: 'x' } }, { status: 429 })));
    const { footer } = await subscribe('karan@example.com');
    expect(await within(footer).findByRole('status')).toHaveTextContent('Too many sign-ups from here. Please try again later.');
  });

  it('asks to try again after a network failure, keeping the email', async () => {
    server.use(http.post('*/api/newsletter', () => HttpResponse.error()));
    const { footer, input } = await subscribe('karan@example.com');
    expect(await within(footer).findByRole('status')).toHaveTextContent("Couldn't subscribe right now. Please try again.");
    expect(input).toHaveValue('karan@example.com');
  });
});

describe('unsubscribe page (F-018)', () => {
  it('asks before unsubscribing, then confirms', async () => {
    addSubscriber('karan@example.com', 'abc123');
    server.use(http.get('*/api/newsletter/unsubscribe', () => delay(100), { once: true }));
    const user = userEvent.setup();
    renderRoute('/newsletter/unsubscribe?token=abc123');
    expect(await screen.findByLabelText('Loading')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Unsubscribe k••••@example.com?' })).toBeInTheDocument();
    // Opening the page alone changes nothing.
    expect(subscribers.get('karan@example.com')?.active).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Unsubscribe' }));
    expect(await screen.findByRole('heading', { name: "You're unsubscribed" })).toBeInTheDocument();
    expect(subscribers.get('karan@example.com')?.active).toBe(false);
  });

  it('says an unknown or used link is not valid', async () => {
    renderRoute('/newsletter/unsubscribe?token=nope');
    expect(await screen.findByRole('heading', { name: "This link isn't valid anymore." })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unsubscribe' })).not.toBeInTheDocument();
  });

  it('says a link without a token is not valid', async () => {
    renderRoute('/newsletter/unsubscribe');
    expect(await screen.findByRole('heading', { name: "This link isn't valid anymore." })).toBeInTheDocument();
  });
});
