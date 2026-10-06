import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiErrorBody } from '@store/shared';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } } satisfies ApiErrorBody);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } } satisfies ApiErrorBody);
    return;
  }
  // Malformed JSON bodies from express.json()
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid request body' } } satisfies ApiErrorBody);
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } } satisfies ApiErrorBody);
};
