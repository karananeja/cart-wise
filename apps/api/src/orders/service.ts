import { randomBytes } from 'node:crypto';
import {
  deliveryOptions,
  PAYMENT_HOLD_MS,
  type Address,
  type CheckoutBlocker,
  type CheckoutQuote,
  type DeliveryOption,
  type Order,
  type OrderStatus,
} from '@store/shared';
import type { AddressService } from '../addresses/service.js';
import type { CartService } from '../cart/service.js';
import type { Db } from '../db/database.js';
import { HttpError } from '../http/errors.js';

interface OrderRow {
  id: string;
  user_id: number;
  status: OrderStatus;
  address: string;
  delivery: string;
  item_count: number;
  mrp_paise: number;
  discount_paise: number;
  delivery_paise: number;
  total_paise: number;
  created_at: string;
  hold_expires_at: string;
  hold_released_at: string | null;
}

interface LineRow {
  product_id: number;
  variant_id: number | null;
  slug: string;
  title: string;
  size: string | null;
  thumbnail_url: string;
  quantity: number;
  unit_price_paise: number;
  unit_mrp_paise: number;
}

/** `ORD-` + 8 characters from an unambiguous alphabet. */
function newOrderId(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return `ORD-${Array.from(randomBytes(8), (b) => alphabet[b % alphabet.length]).join('')}`;
}

interface Deps {
  db: Db;
  carts: CartService;
  addresses: AddressService;
  clock?: () => number;
}

export function createOrderService({ db, carts, addresses, clock = Date.now }: Deps) {
  const iso = (ms: number) => new Date(ms).toISOString();

  const cartLines = db.prepare(`
    SELECT l.id, l.product_id, l.variant_id, l.quantity FROM cart_lines l JOIN carts c ON c.id = l.cart_id
    WHERE c.user_id = ? ORDER BY l.added_at DESC, l.id DESC`);
  const reserve = db.prepare(`
    UPDATE inventory SET reserved = reserved + @q, updated_at = @now
    WHERE product_id = @productId AND IFNULL(variant_id, 0) = IFNULL(@variantId, 0) AND on_hand - reserved >= @q`);
  const unreserve = db.prepare(`
    UPDATE inventory SET reserved = MAX(reserved - @q, 0), updated_at = @now
    WHERE product_id = @productId AND IFNULL(variant_id, 0) = IFNULL(@variantId, 0)`);
  const insertOrder = db.prepare(`
    INSERT INTO orders (id, user_id, status, address, delivery, item_count, mrp_paise, discount_paise, delivery_paise, total_paise,
      created_at, hold_expires_at, updated_at)
    VALUES (@id, @userId, 'pending_payment', @address, @delivery, @itemCount, @mrpPaise, @discountPaise, @deliveryPaise, @totalPaise,
      @now, @holdExpiresAt, @now)`);
  const insertLine = db.prepare(`
    INSERT INTO order_lines (order_id, product_id, variant_id, slug, title, size, thumbnail_url, quantity, unit_price_paise, unit_mrp_paise)
    VALUES (@orderId, @productId, @variantId, @slug, @title, @size, @thumbnailUrl, @quantity, @unitPricePaise, @unitMrpPaise)`);
  const findOrder = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
  const orderLines = db.prepare('SELECT * FROM order_lines WHERE order_id = ? ORDER BY id');
  const pendingForUser = db.prepare("SELECT id FROM orders WHERE user_id = ? AND status = 'pending_payment'");
  const expiredPending = db.prepare("SELECT id FROM orders WHERE status = 'pending_payment' AND hold_expires_at < ?");
  const setStatus = db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?');
  const markReleased = db.prepare('UPDATE orders SET hold_released_at = ? WHERE id = ? AND hold_released_at IS NULL');

  const pickAddress = (userId: number, addressId: number | undefined): Address | null => {
    const list = addresses.list(userId);
    return list.find((a) => a.id === addressId) ?? list.find((a) => a.isDefault) ?? list[0] ?? null;
  };

  /** Returns held stock to sale. Guarded so it happens at most once per order. */
  const release = (orderId: string) => {
    if (markReleased.run(iso(clock()), orderId).changes === 0) return;
    for (const line of orderLines.all(orderId) as LineRow[]) {
      unreserve.run({ q: line.quantity, productId: line.product_id, variantId: line.variant_id, now: iso(clock()) });
    }
  };

  const end = db.transaction((orderId: string, status: OrderStatus) => {
    setStatus.run(status, iso(clock()), orderId);
    release(orderId);
  });

  /** Unpaid holds past their time become Payment expired, and their stock is released. */
  const sweepExpired = () => {
    for (const { id } of expiredPending.all(iso(clock())) as { id: string }[]) end(id, 'payment_expired');
  };

  const toOrder = (row: OrderRow): Order => ({
    id: row.id,
    status: row.status,
    lines: (orderLines.all(row.id) as LineRow[]).map((l) => ({
      productId: l.product_id,
      slug: l.slug,
      title: l.title,
      size: l.size,
      thumbnailUrl: l.thumbnail_url,
      quantity: l.quantity,
      unitPricePaise: l.unit_price_paise,
      unitMrpPaise: l.unit_mrp_paise,
    })),
    address: JSON.parse(row.address) as Order['address'],
    delivery: JSON.parse(row.delivery) as Order['delivery'],
    totals: {
      itemCount: row.item_count,
      mrpPaise: row.mrp_paise,
      discountPaise: row.discount_paise,
      deliveryPaise: row.delivery_paise,
      totalPaise: row.total_paise,
    },
    createdAt: row.created_at,
    holdExpiresAt: row.hold_expires_at,
  });

  function quote(userId: number, addressId: number | undefined, delivery: DeliveryOption): CheckoutQuote {
    const cart = carts.view({ userId });
    const address = pickAddress(userId, addressId);
    const options = deliveryOptions(cart.totals.subtotalPaise, new Date(clock()));
    const chosen = options.find((o) => o.option === delivery)!;
    const blockers: CheckoutBlocker[] = [];
    if (cart.lines.length === 0) blockers.push('EMPTY_CART');
    else if (cart.hasIssues) blockers.push('CART_ISSUES');
    if (!address) blockers.push('NO_ADDRESS');
    return {
      cart,
      address,
      delivery: options,
      selectedDelivery: delivery,
      totals: {
        itemCount: cart.totals.itemCount,
        mrpPaise: cart.totals.mrpPaise,
        discountPaise: cart.totals.discountPaise,
        deliveryPaise: chosen.pricePaise,
        totalPaise: cart.totals.subtotalPaise + chosen.pricePaise,
      },
      blockers,
    };
  }

  return {
    quote,
    sweepExpired,

    /**
     * Creates a Pending Payment order and holds its stock, all in one transaction: if any line
     * can't be reserved, nothing is (spec FR-12–FR-14). The user's previous unpaid hold is
     * cancelled first.
     */
    create: db.transaction((userId: number, addressId: number | undefined, delivery: DeliveryOption): Order => {
      for (const { id } of pendingForUser.all(userId) as { id: string }[]) end(id, 'cancelled');

      const q = quote(userId, addressId, delivery);
      if (q.blockers.includes('EMPTY_CART')) throw new HttpError(400, 'EMPTY_CART', 'Your cart is empty');
      if (q.blockers.includes('CART_ISSUES')) throw new HttpError(409, 'CART_CHANGED', 'Some items in your cart changed');
      if (!q.address || (addressId !== undefined && q.address.id !== addressId)) throw new HttpError(400, 'NO_ADDRESS', 'Choose a delivery address');

      const now = clock();
      const raw = cartLines.all(userId) as { id: number; product_id: number; variant_id: number | null; quantity: number }[];
      const variantOf = new Map(raw.map((r) => [r.id, r.variant_id]));
      for (const line of raw) {
        const reserved = reserve.run({ q: line.quantity, productId: line.product_id, variantId: line.variant_id, now: iso(now) }).changes;
        if (reserved === 0) throw new HttpError(409, 'CART_CHANGED', 'Some items in your cart changed');
      }

      const id = newOrderId();
      const { id: _id, isDefault: _isDefault, createdAt: _createdAt, ...address } = q.address;
      const delivered = q.delivery.find((d) => d.option === delivery)!;
      insertOrder.run({
        id,
        userId,
        address: JSON.stringify(address),
        delivery: JSON.stringify(delivered),
        ...q.totals,
        now: iso(now),
        holdExpiresAt: iso(now + PAYMENT_HOLD_MS),
      });
      q.cart.lines.forEach((line) => {
        insertLine.run({
          orderId: id,
          productId: line.product.id,
          variantId: variantOf.get(line.id) ?? null,
          slug: line.product.slug,
          title: line.product.title,
          size: line.size,
          thumbnailUrl: line.product.thumbnailUrl,
          quantity: line.quantity,
          unitPricePaise: line.product.pricePaise,
          unitMrpPaise: line.product.mrpPaise,
        });
      });
      return toOrder(findOrder.get(id, userId) as OrderRow);
    }),

    get(userId: number, orderId: string): Order {
      sweepExpired();
      const row = findOrder.get(orderId, userId) as OrderRow | undefined;
      if (!row) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found');
      return toOrder(row);
    },

    cancel(userId: number, orderId: string): Order {
      sweepExpired();
      const row = findOrder.get(orderId, userId) as OrderRow | undefined;
      if (!row) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found');
      if (row.status !== 'pending_payment') throw new HttpError(409, 'ORDER_NOT_PENDING', 'This order can no longer be cancelled here');
      end(orderId, 'cancelled');
      return toOrder(findOrder.get(orderId, userId) as OrderRow);
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
