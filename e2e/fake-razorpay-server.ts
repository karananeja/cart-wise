import { createServer } from 'node:http';
import { createFakeRazorpay } from '../apps/api/src/payments/fakeRazorpay.js';

/**
 * A local stand-in for Razorpay during E2E (F-014): the API talks to it instead of
 * api.razorpay.com, and the stubbed checkout.js calls /__checkout/pay to act as the customer.
 * Nothing here reaches Razorpay.
 */
export const FAKE_RAZORPAY_PORT = 3199;
export const FAKE_RAZORPAY_SECRET = 'e2e_test_secret';

const fake = createFakeRazorpay(FAKE_RAZORPAY_SECRET);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = chunks.length ? (JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>) : {};
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  if (path === '/__health') return res.writeHead(200, cors).end('ok');
  if (req.method === 'POST' && path === '/__checkout/pay') {
    const response = fake.pay(String(body.order_id), { method: String(body.method ?? 'card') });
    return res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify(response));
  }
  const answer = await fake.handle(req.method ?? 'GET', path, body);
  res.writeHead(answer.status, { 'Content-Type': 'application/json' }).end(await answer.text());
}).listen(FAKE_RAZORPAY_PORT);
