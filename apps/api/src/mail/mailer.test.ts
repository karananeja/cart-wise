import { describe, expect, it } from 'vitest';
import { loadMailerConfig } from './mailer.js';

const FULL = { SMTP_HOST: 'smtp-relay.brevo.com', SMTP_PORT: '587', SMTP_USER: 'me@example.com', SMTP_PASS: 'secret-pass', SMTP_FROM: 'Cartwise <me@example.com>' };

describe('loadMailerConfig (F-016)', () => {
  it('is off without settings, and blank values count as unset', () => {
    expect(loadMailerConfig({})).toEqual({ enabled: false });
    expect(loadMailerConfig({ SMTP_HOST: ' ', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: '', SMTP_SECURE: '' })).toEqual({ enabled: false });
  });

  it('is off with partial settings, naming what is missing but never the password', () => {
    const partial = loadMailerConfig({ ...FULL, SMTP_PASS: '', SMTP_FROM: ' ' });
    expect(partial).toEqual({ enabled: false, error: 'Email is off (codes are shown on screen): set SMTP_PASS, SMTP_FROM too.' });
    expect(JSON.stringify(loadMailerConfig({ ...FULL, SMTP_HOST: '' }))).not.toContain('secret-pass');
    expect(loadMailerConfig({ ...FULL, SMTP_PORT: 'abc' })).toMatchObject({ enabled: false, error: expect.stringMatching(/SMTP_PORT/) });
  });

  it('is on with complete settings; TLS follows SMTP_SECURE, else the port', () => {
    expect(loadMailerConfig(FULL)).toEqual({
      enabled: true,
      config: { host: 'smtp-relay.brevo.com', port: 587, secure: false, user: 'me@example.com', pass: 'secret-pass', from: 'Cartwise <me@example.com>' },
    });
    expect(loadMailerConfig({ ...FULL, SMTP_PORT: '465' })).toMatchObject({ config: { secure: true } });
    expect(loadMailerConfig({ ...FULL, SMTP_SECURE: 'true' })).toMatchObject({ config: { secure: true } });
    expect(loadMailerConfig({ ...FULL, SMTP_PORT: '465', SMTP_SECURE: 'false' })).toMatchObject({ config: { secure: false } });
  });
});
