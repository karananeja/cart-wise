import type { ApiErrorBody } from '@store/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
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

/** Fetches JSON from the application API. Network failures surface as status 0. */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(response.status, body?.error.code ?? 'UNKNOWN');
  }
  return (await response.json()) as T;
}
