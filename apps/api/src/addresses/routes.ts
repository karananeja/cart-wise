import { Router, type Request, type Response } from 'express';
import { checkAddress } from '@store/shared';
import type { Db } from '../db/database.js';
import { HttpError } from '../http/errors.js';
import { currentUser } from '../http/owner.js';
import type { GeoService } from '../geo/service.js';
import type { AddressService } from './service.js';

function requireUserId(res: Response): number {
  const user = currentUser(res);
  if (!user) throw new HttpError(401, 'SIGNED_OUT', 'Please sign in');
  return user.id;
}

function addressId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'ADDRESS_NOT_FOUND', 'Address not found');
  return id;
}

function validated(body: unknown) {
  const { errors, values } = checkAddress((typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>);
  if (Object.keys(errors).length) throw new HttpError(400, 'VALIDATION', 'Please check the highlighted fields', { fields: errors });
  return values;
}

export function addressRouter(addresses: AddressService): Router {
  const router = Router();

  router.get('/addresses', (_req, res) => {
    res.json({ addresses: addresses.list(requireUserId(res)) });
  });

  router.post('/addresses', (req, res) => {
    const userId = requireUserId(res);
    const makeDefault = (req.body as { makeDefault?: unknown } | undefined)?.makeDefault === true;
    res.json({ addresses: addresses.create(userId, validated(req.body), { makeDefault }) });
  });

  router.put('/addresses/:id', (req, res) => {
    res.json({ addresses: addresses.update(requireUserId(res), addressId(req), validated(req.body)) });
  });

  router.delete('/addresses/:id', (req, res) => {
    res.json(addresses.remove(requireUserId(res), addressId(req)));
  });

  router.post('/addresses/:id/default', (req, res) => {
    res.json({ addresses: addresses.setDefault(requireUserId(res), addressId(req)) });
  });

  return router;
}

export function geoRouter(geo: GeoService): Router {
  const router = Router();

  router.get('/geo/search', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    res.json({ places: await geo.search(q) });
  });

  router.get('/geo/reverse', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      throw new HttpError(400, 'BAD_REQUEST', 'Invalid position');
    }
    res.json({ place: await geo.reverse(lat, lon) });
  });

  return router;
}

