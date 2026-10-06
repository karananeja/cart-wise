import { MAX_ADDRESSES, type Address, type AddressInput } from '@store/shared';
import type { Db } from '../db/database.js';
import { HttpError } from '../http/errors.js';

interface Row {
  id: number;
  full_name: string;
  mobile: string;
  pincode: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  type: Address['type'];
  latitude: number | null;
  longitude: number | null;
  is_default: number;
  created_at: string;
}

const toAddress = (r: Row): Address => ({
  id: r.id,
  fullName: r.full_name,
  mobile: r.mobile,
  pincode: r.pincode,
  line1: r.line1,
  line2: r.line2,
  landmark: r.landmark,
  city: r.city,
  state: r.state,
  type: r.type,
  latitude: r.latitude,
  longitude: r.longitude,
  isDefault: r.is_default === 1,
  createdAt: r.created_at,
});

/** Every query is scoped to the owner, so one account can never see or change another's. */
export function createAddressService(db: Db) {
  const now = () => new Date().toISOString();
  const list = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC, id DESC');
  const count = db.prepare('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?');
  const find = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?');
  const insert = db.prepare(`
    INSERT INTO addresses (user_id, full_name, mobile, pincode, line1, line2, landmark, city, state, type, latitude, longitude, is_default, created_at, updated_at)
    VALUES (@userId, @fullName, @mobile, @pincode, @line1, @line2, @landmark, @city, @state, @type, @latitude, @longitude, 0, @now, @now)`);
  const update = db.prepare(`
    UPDATE addresses SET full_name = @fullName, mobile = @mobile, pincode = @pincode, line1 = @line1, line2 = @line2,
      landmark = @landmark, city = @city, state = @state, type = @type, latitude = @latitude, longitude = @longitude, updated_at = @now
    WHERE id = @id AND user_id = @userId`);
  const clearDefault = db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?');
  const markDefault = db.prepare('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?');
  const remove = db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?');
  const newest = db.prepare('SELECT id FROM addresses WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1');

  const all = (userId: number) => (list.all(userId) as Row[]).map(toAddress);
  const requireOwn = (userId: number, id: number): Row => {
    const row = find.get(id, userId) as Row | undefined;
    if (!row) throw new HttpError(404, 'ADDRESS_NOT_FOUND', 'Address not found');
    return row;
  };
  const makeDefault = (userId: number, id: number) => {
    clearDefault.run(userId);
    markDefault.run(id, userId);
  };

  return {
    list: all,

    /** The first address becomes the default; `makeDefault` lets Undo restore a deleted default. */
    create: db.transaction((userId: number, values: AddressInput, options: { makeDefault?: boolean } = {}): Address[] => {
      const existing = (count.get(userId) as { n: number }).n;
      if (existing >= MAX_ADDRESSES) {
        throw new HttpError(409, 'ADDRESS_LIMIT', `You can save up to ${MAX_ADDRESSES} addresses`);
      }
      const id = Number(insert.run({ ...values, userId, now: now() }).lastInsertRowid);
      if (existing === 0 || options.makeDefault) makeDefault(userId, id);
      return all(userId);
    }),

    update(userId: number, id: number, values: AddressInput): Address[] {
      requireOwn(userId, id);
      update.run({ ...values, id, userId, now: now() });
      return all(userId);
    },

    /** Deleting the default promotes the most recently added remaining address. */
    remove: db.transaction((userId: number, id: number): { addresses: Address[]; promotedId: number | null } => {
      const row = requireOwn(userId, id);
      remove.run(id, userId);
      let promotedId: number | null = null;
      if (row.is_default === 1) {
        const next = newest.get(userId) as { id: number } | undefined;
        if (next) {
          makeDefault(userId, next.id);
          promotedId = next.id;
        }
      }
      return { addresses: all(userId), promotedId };
    }),

    setDefault: db.transaction((userId: number, id: number): Address[] => {
      requireOwn(userId, id);
      makeDefault(userId, id);
      return all(userId);
    }),
  };
}

export type AddressService = ReturnType<typeof createAddressService>;
