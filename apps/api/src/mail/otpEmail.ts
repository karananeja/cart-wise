import type { MailMessage } from './mailer.js';

const STORE_NAME = 'Cartwise';

const PURPOSES = {
  signup: 'verify your email for your new Cartwise account',
  login: 'sign in to Cartwise',
  reset: 'reset your Cartwise password',
} as const;

/** The one-time code email (F-016 FR-6): the code, what it is for, 5 minutes, and no links. */
export function otpEmail(to: string, code: string, purpose: keyof typeof PURPOSES, validMinutes: number): MailMessage {
  const action = PURPOSES[purpose];
  const lines = [`Your code is ${code}.`, `Use it to ${action}. It is valid for ${validMinutes} minutes.`, "If this wasn't you, ignore this email."];
  return {
    to,
    subject: `${code} is your ${STORE_NAME} code`,
    text: `${lines.join('\n\n')}\n\n${STORE_NAME}\n`,
    html: [
      '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#111">',
      `<p>Your code is</p><p style="font-size:28px;font-weight:600;letter-spacing:6px;margin:8px 0">${code}</p>`,
      `<p>Use it to ${action}. It is valid for ${validMinutes} minutes.</p>`,
      "<p style=\"color:#555\">If this wasn't you, ignore this email.</p>",
      `<p style="color:#555">${STORE_NAME}</p>`,
      '</div>',
    ].join(''),
  };
}
