import nodemailer from 'nodemailer';

/**
 * Outgoing email (F-016, ADR-006): one-time codes go through any SMTP server configured in
 * apps/api/.env. Everything else talks to the `Mailer` interface, so tests inject a fake. The SMTP
 * password stays here: it is never logged or put in an error.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  /** TLS from the start (usually port 465); otherwise STARTTLS is used when offered. */
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export type MailerSetup = { enabled: true; config: SmtpConfig } | { enabled: false; error?: string };

const REQUIRED = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] as const;
const TIMEOUT_MS = 10_000;

/** Reads the environment. Blank values count as unset; partial settings leave email off (demo codes). */
export function loadMailerConfig(env: Record<string, string | undefined>): MailerSetup {
  const value = (key: string) => env[key]?.trim() || undefined;
  const missing = REQUIRED.filter((key) => !value(key));
  if (missing.length === REQUIRED.length) return { enabled: false };
  if (missing.length) return { enabled: false, error: `Email is off (codes are shown on screen): set ${missing.join(', ')} too.` };
  const port = Number(value('SMTP_PORT'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { enabled: false, error: 'Email is off (codes are shown on screen): SMTP_PORT should be a port number.' };
  const secure = value('SMTP_SECURE');
  return {
    enabled: true,
    config: {
      host: value('SMTP_HOST')!,
      port,
      secure: secure ? ['true', '1', 'yes'].includes(secure.toLowerCase()) : port === 465,
      user: value('SMTP_USER')!,
      pass: value('SMTP_PASS')!,
      from: value('SMTP_FROM')!,
    },
  };
}

/** A nodemailer SMTP transport with 10 s timeouts, so a stuck server fails the request instead of hanging it. */
export function createSmtpMailer(config: SmtpConfig): Mailer {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
  return {
    async send(message) {
      await transport.sendMail({ from: config.from, ...message });
    },
  };
}
