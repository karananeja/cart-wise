/**
 * Outgoing email through the MSG91 Email API (F-016 change of 2026-10-07, ADR-007). MSG91 sends
 * templates stored in its panel, so callers pass variables, not a subject or body. Everything else
 * talks to the `Mailer` interface, so tests inject a fake. The auth key stays here: it is never
 * logged or put in an error. Plain HTTPS (fetch), so it also runs on serverless hosts.
 */
export type OtpEmailPurpose = 'signup' | 'login' | 'reset';

export interface Mailer {
  /** The one-time code email (template MSG91_TEMPLATE_ID). */
  sendOtp(to: string, otp: string, purpose: OtpEmailPurpose, validMinutes: number): Promise<void>;
  /** Whether a newsletter welcome template is configured (F-018); without it no welcome email is sent. */
  readonly sendsNewsletterWelcome: boolean;
  sendNewsletterWelcome(to: string, unsubscribeUrl: string): Promise<void>;
}

export interface Msg91Config {
  authKey: string;
  otpTemplateId: string;
  newsletterTemplateId: string | null;
  fromEmail: string;
  fromName: string;
  /** The sending domain verified in MSG91 (defaults to the sender address's domain). */
  domain: string;
  apiUrl: string;
}

export type MailerSetup = { enabled: true; config: Msg91Config } | { enabled: false; error?: string };

export const MSG91_EMAIL_API_URL = 'https://control.msg91.com/api/v5/email/send';
const REQUIRED = ['MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID', 'MSG91_FROM_EMAIL'] as const;
const TIMEOUT_MS = 10_000;
const STORE_NAME = 'Cartwise';

/** What each code is for, as the template's `purpose` variable ("Use it to …"). */
const PURPOSES: Record<OtpEmailPurpose, string> = {
  signup: 'verify your email for your new Cartwise account',
  login: 'sign in to Cartwise',
  reset: 'reset your Cartwise password',
};

/** Reads the environment. Blank values count as unset; partial settings leave email off (demo codes). */
export function loadMailerConfig(env: Record<string, string | undefined>): MailerSetup {
  const value = (key: string) => env[key]?.trim() || undefined;
  const missing = REQUIRED.filter((key) => !value(key));
  if (missing.length === REQUIRED.length) return { enabled: false };
  if (missing.length) return { enabled: false, error: `Email is off (codes are shown on screen): set ${missing.join(', ')} too.` };
  const fromEmail = value('MSG91_FROM_EMAIL')!;
  const fromDomain = /^[^@\s]+@([^@\s]+\.[^@\s]+)$/.exec(fromEmail)?.[1];
  if (!fromDomain) return { enabled: false, error: 'Email is off (codes are shown on screen): MSG91_FROM_EMAIL should be an email address.' };
  return {
    enabled: true,
    config: {
      authKey: value('MSG91_AUTH_KEY')!,
      otpTemplateId: value('MSG91_TEMPLATE_ID')!,
      newsletterTemplateId: value('MSG91_NEWSLETTER_TEMPLATE_ID') ?? null,
      fromEmail,
      fromName: value('MSG91_FROM_NAME') ?? STORE_NAME,
      domain: value('MSG91_DOMAIN') ?? fromDomain,
      apiUrl: value('MSG91_API_URL') ?? MSG91_EMAIL_API_URL,
    },
  };
}

/** A send failure with a short code for the log (HTTP status, TIMEOUT or NETWORK), never the response body. */
export class EmailSendError extends Error {
  constructor(readonly code: string) {
    super(`Email send failed (${code})`);
  }
}

/** The MSG91 "send email" request body for one recipient and a template's variables. */
export function msg91EmailRequest(config: Msg91Config, to: string, templateId: string, variables: Record<string, string>) {
  return {
    recipients: [{ to: [{ email: to }], variables }],
    from: { name: config.fromName, email: config.fromEmail },
    domain: config.domain,
    template_id: templateId,
  };
}

export function createMsg91Mailer(config: Msg91Config, fetchImpl: typeof fetch = fetch): Mailer {
  async function send(to: string, templateId: string, variables: Record<string, string>) {
    let response: Response;
    try {
      response = await fetchImpl(config.apiUrl, {
        method: 'POST',
        headers: { authkey: config.authKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(msg91EmailRequest(config, to, templateId, variables)),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new EmailSendError((error as { name?: string }).name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK');
    }
    // MSG91 answers JSON; a 2xx can still report a failure in the body.
    const body = (await response.json().catch(() => null)) as { hasError?: unknown; status?: unknown } | null;
    if (!response.ok) throw new EmailSendError(`HTTP ${response.status}`);
    if (body?.hasError === true || body?.status === 'fail') throw new EmailSendError('REJECTED');
  }

  return {
    sendOtp: (to, otp, purpose, validMinutes) =>
      send(to, config.otpTemplateId, { otp, purpose: PURPOSES[purpose], minutes: String(validMinutes), store: STORE_NAME }),
    sendsNewsletterWelcome: config.newsletterTemplateId !== null,
    sendNewsletterWelcome: async (to, unsubscribeUrl) => {
      if (config.newsletterTemplateId) await send(to, config.newsletterTemplateId, { unsubscribe_url: unsubscribeUrl, store: STORE_NAME });
    },
  };
}
