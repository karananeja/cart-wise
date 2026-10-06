import type { ApiErrorBody } from '@store/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(`API ${status} ${code}`);
  }

  get isNotFound() {
    return this.status === 404;
  }
}

/** Absolute URL for an API path (absolute so it also works under the test environment). */
export function apiUrl(path: string): string {
  return new URL(`/api${path}`, window.location.origin).toString();
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, headers: { Accept: 'application/json', ...init.headers } });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(response.status, body?.error.code ?? 'UNKNOWN', body?.error.details);
  }
  return (await response.json()) as T;
}

/** Fetches JSON from the application API. Network failures surface as status 0. */
export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { signal });
}

/** Sends a JSON body (POST/PATCH/DELETE). Cookies go with it, as for any same-origin request. */
export function apiSend<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
