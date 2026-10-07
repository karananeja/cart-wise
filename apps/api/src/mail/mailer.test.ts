import { describe, expect, it } from 'vitest';
import { createMsg91Mailer, loadMailerConfig, MSG91_EMAIL_API_URL, type Msg91Config } from './mailer.js';

const FULL = { MSG91_AUTH_KEY: 'secret-auth-key', MSG91_TEMPLATE_ID: 'otp_template', MSG91_FROM_EMAIL: 'no-reply@mail.cartwise.example' };

describe('loadMailerConfig (MSG91, ADR-007)', () => {
  it('is off without settings, and blank values count as unset', () => {
    expect(loadMailerConfig({})).toEqual({ enabled: false });
    expect(loadMailerConfig({ MSG91_AUTH_KEY: ' ', MSG91_TEMPLATE_ID: '', MSG91_FROM_EMAIL: '' })).toEqual({ enabled: false });
  });

  it('is off when EMAIL_DELIVERY=demo, even with complete settings', () => {
    expect(loadMailerConfig({ ...FULL, EMAIL_DELIVERY: 'demo' })).toEqual({ enabled: false });
    expect(loadMailerConfig({ ...FULL, EMAIL_DELIVERY: ' Demo ' })).toEqual({ enabled: false });
    expect(loadMailerConfig({ ...FULL, EMAIL_DELIVERY: '' })).toMatchObject({ enabled: true });
  });

  it('is off with partial settings, naming what is missing but never the auth key', () => {
    expect(loadMailerConfig({ ...FULL, MSG91_TEMPLATE_ID: '' })).toEqual({ enabled: false, error: 'Email is off (codes are shown on screen): set MSG91_TEMPLATE_ID too.' });
    expect(JSON.stringify(loadMailerConfig({ ...FULL, MSG91_FROM_EMAIL: '' }))).not.toContain('secret-auth-key');
    expect(loadMailerConfig({ ...FULL, MSG91_FROM_EMAIL: 'not-an-email' })).toMatchObject({ enabled: false, error: expect.stringMatching(/MSG91_FROM_EMAIL/) });
  });

  it('is on with the three settings; the domain comes from the sender unless set', () => {
    expect(loadMailerConfig(FULL)).toEqual({
      enabled: true,
      config: {
        authKey: 'secret-auth-key',
        otpTemplateId: 'otp_template',
        newsletterTemplateId: null,
        fromEmail: 'no-reply@mail.cartwise.example',
        fromName: 'Cartwise',
        domain: 'mail.cartwise.example',
        apiUrl: MSG91_EMAIL_API_URL,
      },
    });
    expect(loadMailerConfig({ ...FULL, MSG91_DOMAIN: 'cartwise.example', MSG91_FROM_NAME: 'Cartwise Shop', MSG91_NEWSLETTER_TEMPLATE_ID: 'welcome' })).toMatchObject({
      config: { domain: 'cartwise.example', fromName: 'Cartwise Shop', newsletterTemplateId: 'welcome' },
    });
  });
});

describe('createMsg91Mailer', () => {
  const config = (loadMailerConfig({ ...FULL, MSG91_NEWSLETTER_TEMPLATE_ID: 'welcome' }) as { config: Msg91Config }).config;
  const capture = (response: () => Response | Promise<Response>) => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return response();
    }) as unknown as typeof fetch;
    return { calls, fetchImpl };
  };
  const ok = () => Response.json({ status: 'success', hasError: false, data: { unique_id: 'x' } });

  it('posts the OTP template with its variables and the auth key header', async () => {
    const { calls, fetchImpl } = capture(ok);
    await createMsg91Mailer(config, fetchImpl).sendOtp('karan@example.com', '123456', 'login', 5);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(MSG91_EMAIL_API_URL);
    expect(calls[0]!.init.method).toBe('POST');
    expect(calls[0]!.init.headers).toMatchObject({ authkey: 'secret-auth-key', 'Content-Type': 'application/json' });
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      recipients: [{ to: [{ email: 'karan@example.com' }], variables: { otp: '123456', purpose: 'sign in to Cartwise', minutes: '5', store: 'Cartwise' } }],
      from: { name: 'Cartwise', email: 'no-reply@mail.cartwise.example' },
      domain: 'mail.cartwise.example',
      template_id: 'otp_template',
    });
  });

  it('sends the newsletter welcome only when its template is set', async () => {
    const { calls, fetchImpl } = capture(ok);
    const mailer = createMsg91Mailer(config, fetchImpl);
    expect(mailer.sendsNewsletterWelcome).toBe(true);
    await mailer.sendNewsletterWelcome('karan@example.com', 'https://shop.example/newsletter/unsubscribe?token=t');
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
      recipients: [{ variables: { unsubscribe_url: 'https://shop.example/newsletter/unsubscribe?token=t' } }],
      template_id: 'welcome',
    });
    expect(createMsg91Mailer({ ...config, newsletterTemplateId: null }, fetchImpl).sendsNewsletterWelcome).toBe(false);
  });

  it('fails with a short code on HTTP errors, rejected sends and network errors, never echoing the key', async () => {
    const failures: [() => Response | Promise<Response>, string][] = [
      [() => Response.json({ message: 'Unauthorized secret-auth-key' }, { status: 401 }), 'HTTP 401'],
      [() => Response.json({ status: 'fail', hasError: true, errors: { template_id: ['invalid'] } }), 'REJECTED'],
      [() => Promise.reject(new TypeError('fetch failed')), 'NETWORK'],
    ];
    for (const [response, code] of failures) {
      const { fetchImpl } = capture(response);
      const error = await createMsg91Mailer(config, fetchImpl).sendOtp('karan@example.com', '123456', 'signup', 5).catch((e: unknown) => e);
      expect(error).toMatchObject({ code });
      expect(String((error as Error).message)).not.toContain('secret-auth-key');
    }
  });
});
