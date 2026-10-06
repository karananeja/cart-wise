import { http, HttpResponse } from 'msw';
import {
  DEFAULT_SIM_INTERVAL,
  DELIVERY_CODE_ATTEMPTS,
  MAX_ON_HAND,
  nextStatus,
  type InventoryChange,
  type InventoryFilter,
  type Order,
  type SimAutomation,
  type SimInventoryProduct,
  type SimInventoryUnit,
  type SimIntervalSeconds,
  type SimOrder,
} from '@store/shared';
import { allOrders, getOrder, saveOrder } from './checkoutServer';

/** Mock demo-operator API. The password and limits are covered by the API tests. */
export const OPERATOR_PASSWORD = 'demo-operator';

let signedIn = false;
let wrongPasswords = 0;
const attempts = new Map<string, number>();
let nextCode = 4831;

export function resetSim() {
  signedIn = false;
  wrongPasswords = 0;
  attempts.clear();
  nextCode = 4831;
  stock = seedStock();
  settings = { autoDecrease: false, autoRestock: false, intervalSeconds: DEFAULT_SIM_INTERVAL };
  changeLog = [];
}

// ── Inventory simulation (F-011) ──────────────────────────────────────────────────────────

interface MockUnit {
  productId: number;
  variantId: number | null;
  size: string | null;
  kind: 'size' | 'option' | null;
  onHand: number;
  held: number;
}
interface MockProduct {
  productId: number;
  slug: string;
  title: string;
  categoryName: string;
  units: MockUnit[];
}

const PAGE_SIZE = 20;

/** A mug (in stock, 2 held), a lamp (low), a sold-out kettle, a sized tee, a phone with options, and filler for paging. */
function seedStock(): MockProduct[] {
  const unsized = (productId: number, title: string, onHand: number, held = 0): MockProduct => ({
    productId,
    slug: title.toLowerCase().replace(/\s+/g, '-'),
    title,
    categoryName: 'Kitchen',
    units: [{ productId, variantId: null, size: null, kind: null, onHand, held }],
  });
  return [
    unsized(1, 'Coffee Mug', 12, 2),
    unsized(2, 'Desk Lamp', 3),
    unsized(3, 'Electric Kettle', 0),
    {
      productId: 4,
      slug: 'cotton-tee',
      title: 'Cotton Tee',
      categoryName: 'Tops',
      units: [
        { productId: 4, variantId: 41, size: 'S', kind: 'size', onHand: 0, held: 0 },
        { productId: 4, variantId: 42, size: 'M', kind: 'size', onHand: 7, held: 0 },
      ],
    },
    {
      productId: 5,
      slug: 'galaxy-phone',
      title: 'Galaxy Phone',
      categoryName: 'Smartphones',
      units: [
        { productId: 5, variantId: 51, size: '128 GB', kind: 'option', onHand: 9, held: 0 },
        { productId: 5, variantId: 52, size: '256 GB', kind: 'option', onHand: 4, held: 0 },
      ],
    },
    ...Array.from({ length: 21 }, (_, i) => unsized(100 + i, `Filler Product ${String(i + 1).padStart(2, '0')}`, 20)),
  ];
}

let stock = seedStock();
let settings: { autoDecrease: boolean; autoRestock: boolean; intervalSeconds: SimIntervalSeconds } = {
  autoDecrease: false,
  autoRestock: false,
  intervalSeconds: DEFAULT_SIM_INTERVAL,
};
let changeLog: InventoryChange[] = [];

const statusOf = (available: number): SimInventoryUnit['status'] => (available <= 0 ? 'out_of_stock' : available <= 5 ? 'low_stock' : 'in_stock');
const unitView = (u: MockUnit): SimInventoryUnit => ({ ...u, available: u.onHand - u.held, status: statusOf(u.onHand - u.held) });
function productView(p: MockProduct): SimInventoryProduct {
  const units = p.units.map(unitView);
  const sum = (key: 'onHand' | 'held' | 'available') => units.reduce((n, u) => n + u[key], 0);
  const available = sum('available');
  return { productId: p.productId, slug: p.slug, title: p.title, categoryName: p.categoryName, thumbnailUrl: '', onHand: sum('onHand'), held: sum('held'), available, status: statusOf(available), units };
}

export const getStock = (productId: number, variantId: number | null = null) =>
  stock.find((p) => p.productId === productId)?.units.find((u) => u.variantId === variantId);
export const setHeld = (productId: number, held: number) => {
  getStock(productId)!.held = held;
};
export const setAutomation = (patch: Partial<typeof settings>) => {
  settings = { ...settings, ...patch };
};

let logId = 0;
function log(p: MockProduct, u: MockUnit, from: number, source: InventoryChange['source']) {
  changeLog = [{ id: ++logId, at: new Date().toISOString(), productId: p.productId, variantId: u.variantId, title: p.title, size: u.size, fromOnHand: from, toOnHand: u.onHand, source }, ...changeLog].slice(0, 20);
}

const automation = (): SimAutomation => ({
  ...settings,
  nextTickAt: settings.autoDecrease || settings.autoRestock ? new Date(Date.now() + settings.intervalSeconds * 1000).toISOString() : null,
  log: changeLog,
});

export const signInOperator = () => {
  signedIn = true;
};

const error = (status: number, code: string, details?: Record<string, unknown>) =>
  HttpResponse.json({ error: { code, message: code, details } }, { status });

function sim(order: Order): SimOrder {
  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    city: order.address.city,
    items: order.lines.map((l) => ({ title: l.title, size: l.size, option: l.option, quantity: l.quantity })),
    paidPaise: order.payment?.paidPaise ?? 0,
    nextStatus: nextStatus(order.status),
    deliveryAttemptsLeft: order.status === 'out_for_delivery' ? DELIVERY_CODE_ATTEMPTS - (attempts.get(order.id) ?? 0) : null,
    returns: order.returns.map((r) => ({ id: r.id, status: r.status, itemCount: r.lines.length, refundPaise: r.refundPaise })),
    provider: order.payment?.provider ?? 'demo',
    gatewayRefunds: [],
  };
}

const at = () => new Date().toISOString();
const guard = () => (signedIn ? null : error(401, 'OPERATOR_REQUIRED'));
const orderOf = (id: string) => getOrder(id);
const orderWithReturn = (returnId: string) => allOrders().find((o) => o.returns.some((r) => r.id === returnId));

const inventoryHandlers = [
  http.get('*/api/sim/inventory', ({ request }) => {
    const denied = guard();
    if (denied) return denied;
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const filter = (url.searchParams.get('filter') ?? 'all') as InventoryFilter;
    const offset = Number(url.searchParams.get('cursor') ?? 0);
    const matching = stock
      .map(productView)
      .filter((p) => p.title.toLowerCase().includes(q))
      .filter((p) => (filter === 'low' ? p.available >= 1 && p.available <= 5 : filter === 'sold_out' ? p.available <= 0 : true));
    const page = matching.slice(offset, offset + PAGE_SIZE);
    return HttpResponse.json({ products: page, nextCursor: offset + PAGE_SIZE < matching.length ? String(offset + PAGE_SIZE) : null });
  }),
  http.put('*/api/sim/inventory/units', async ({ request }) => {
    const denied = guard();
    if (denied) return denied;
    const body = (await request.json()) as { productId: number; variantId: number | null; onHand: number };
    if (!Number.isInteger(body.onHand) || body.onHand < 0 || body.onHand > MAX_ON_HAND) return error(400, 'BAD_REQUEST');
    const product = stock.find((p) => p.productId === body.productId);
    const unit = product?.units.find((u) => u.variantId === body.variantId);
    if (!product || !unit) return error(404, 'UNIT_NOT_FOUND');
    if (body.onHand < unit.held) return error(409, 'BELOW_HELD', { held: unit.held });
    const from = unit.onHand;
    unit.onHand = body.onHand;
    log(product, unit, from, 'manual');
    return HttpResponse.json({ unit: unitView(unit), product: productView(product) });
  }),
  http.get('*/api/sim/automation', () => guard() ?? HttpResponse.json(automation())),
  http.put('*/api/sim/automation', async ({ request }) => {
    const denied = guard();
    if (denied) return denied;
    settings = (await request.json()) as typeof settings;
    return HttpResponse.json(automation());
  }),
  /** Deterministic stand-in for a tick: decrease takes 1 from the first available unit; restock refills the first low one to 10. */
  http.post('*/api/sim/automation/run', () => {
    const denied = guard();
    if (denied) return denied;
    if (!settings.autoDecrease && !settings.autoRestock) return error(409, 'AUTOMATION_OFF');
    const startId = logId;
    const all = stock.flatMap((p) => p.units.map((u) => [p, u] as const));
    if (settings.autoDecrease) {
      const hit = all.find(([, u]) => u.onHand - u.held >= 1);
      if (hit) {
        const [p, u] = hit;
        u.onHand -= 1;
        log(p, u, u.onHand + 1, 'auto_decrease');
      }
    }
    if (settings.autoRestock) {
      const hit = all.find(([, u]) => u.onHand - u.held <= 5);
      if (hit) {
        const [p, u] = hit;
        const from = u.onHand;
        u.onHand = u.held + 10;
        log(p, u, from, 'auto_restock');
      }
    }
    return HttpResponse.json({ changes: changeLog.filter((c) => c.id > startId), automation: automation() });
  }),
];

export const simHandlers = [
  ...inventoryHandlers,
  http.get('*/api/sim/session', () => HttpResponse.json({ signedIn })),
  http.post('*/api/sim/session', async ({ request }) => {
    const { password } = (await request.json()) as { password: string };
    if (wrongPasswords >= 5) return error(429, 'TOO_MANY_ATTEMPTS', { retryAfterSeconds: 900 });
    if (password !== OPERATOR_PASSWORD) {
      wrongPasswords += 1;
      return error(401, 'WRONG_PASSWORD');
    }
    signedIn = true;
    return HttpResponse.json({ signedIn: true });
  }),
  http.delete('*/api/sim/session', () => {
    signedIn = false;
    return HttpResponse.json({ signedIn: false });
  }),
  http.get('*/api/sim/orders', () => {
    const denied = guard();
    if (denied) return denied;
    const orders = allOrders()
      .filter((o) => o.payment)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json({ orders: orders.map(sim) });
  }),
  http.post('*/api/sim/orders/:id/advance', ({ params }) => {
    const denied = guard();
    if (denied) return denied;
    const order = orderOf(String(params.id));
    if (!order) return error(404, 'ORDER_NOT_FOUND');
    const next = nextStatus(order.status);
    if (!next || next === 'delivered') return error(409, 'INVALID_TRANSITION');
    const updated: Order = {
      ...order,
      status: next,
      history: [...order.history, { status: next, at: at() }],
      ...(next === 'out_for_delivery' ? { deliveryCode: String(nextCode++) } : {}),
    };
    saveOrder(updated);
    return HttpResponse.json({ order: sim(updated) });
  }),
  http.post('*/api/sim/orders/:id/deliver', async ({ params, request }) => {
    const denied = guard();
    if (denied) return denied;
    const order = orderOf(String(params.id));
    if (!order || order.status !== 'out_for_delivery') return error(409, 'INVALID_TRANSITION');
    const used = attempts.get(order.id) ?? 0;
    if (used >= DELIVERY_CODE_ATTEMPTS) return error(423, 'DELIVERY_LOCKED');
    const { code } = (await request.json()) as { code: string };
    if (code !== order.deliveryCode) {
      attempts.set(order.id, used + 1);
      const left = DELIVERY_CODE_ATTEMPTS - used - 1;
      return left <= 0 ? error(423, 'DELIVERY_LOCKED') : error(401, 'INVALID_CODE', { attemptsLeft: left });
    }
    const now = at();
    const updated: Order = { ...order, status: 'delivered', deliveredAt: now, deliveryCode: null, history: [...order.history, { status: 'delivered', at: now }] };
    saveOrder(updated);
    attempts.delete(order.id);
    return HttpResponse.json({ order: sim(updated) });
  }),
  http.post('*/api/sim/orders/:id/delivery-code', ({ params }) => {
    const denied = guard();
    if (denied) return denied;
    const order = orderOf(String(params.id));
    if (!order || order.status !== 'out_for_delivery') return error(409, 'INVALID_TRANSITION');
    const updated = { ...order, deliveryCode: String(nextCode++) };
    saveOrder(updated);
    attempts.delete(order.id);
    return HttpResponse.json({ order: sim(updated) });
  }),
  http.post('*/api/sim/returns/:id/pickup', ({ params }) => {
    const denied = guard();
    if (denied) return denied;
    const order = orderWithReturn(String(params.id));
    const ret = order?.returns.find((r) => r.id === params.id);
    if (!order || !ret || ret.status !== 'requested') return error(409, 'INVALID_TRANSITION');
    const now = at();
    const updated: Order = {
      ...order,
      returns: order.returns.map((r) => (r.id === ret.id ? { ...r, status: 'picked_up', pickedUpAt: now } : r)),
      refunds: [...order.refunds, { id: `RF-${ret.id}`, returnId: ret.id, amountPaise: ret.refundPaise, label: order.payment!.label, status: 'initiated', initiatedAt: now, refundedAt: null }],
    };
    saveOrder(updated);
    return HttpResponse.json({ order: sim(updated) });
  }),
  http.post('*/api/sim/returns/:id/refund', ({ params }) => {
    const denied = guard();
    if (denied) return denied;
    const order = orderWithReturn(String(params.id));
    const ret = order?.returns.find((r) => r.id === params.id);
    if (!order || !ret || ret.status !== 'picked_up') return error(409, 'INVALID_TRANSITION');
    const now = at();
    const updated: Order = {
      ...order,
      returns: order.returns.map((r) => (r.id === ret.id ? { ...r, status: 'refunded', refundedAt: now } : r)),
      refunds: order.refunds.map((f) => (f.returnId === ret.id ? { ...f, status: 'refunded', refundedAt: now } : f)),
    };
    saveOrder(updated);
    return HttpResponse.json({ order: sim(updated) });
  }),
];
