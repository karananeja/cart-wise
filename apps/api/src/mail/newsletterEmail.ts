import type { MailMessage } from './mailer.js';

const STORE_NAME = 'Cartwise';

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The newsletter welcome email (F-018 FR-3): the only newsletter email sent, with its unsubscribe link. */
export function newsletterWelcomeEmail(to: string, unsubscribeUrl: string): MailMessage {
  const lines = [
    `Thanks for subscribing to the ${STORE_NAME} newsletter.`,
    `${STORE_NAME} is a demo store, so no campaigns are sent: this welcome email is the only one you'll get.`,
  ];
  return {
    to,
    subject: `Welcome to the ${STORE_NAME} newsletter`,
    text: `${lines.join('\n\n')}\n\nUnsubscribe: ${unsubscribeUrl}\n\n${STORE_NAME}\n`,
    html: [
      '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#111">',
      ...lines.map((line) => `<p>${line}</p>`),
      `<p style="color:#555"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#555">Unsubscribe</a></p>`,
      `<p style="color:#555">${STORE_NAME}</p>`,
      '</div>',
    ].join(''),
  };
}
