import { newIdempotencyKey } from './utils';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level messages, as produced by the Zod error mapper on the server. */
  get fieldErrors(): Record<string, string> {
    return this.details && typeof this.details === 'object' && !Array.isArray(this.details)
      ? (this.details as Record<string, string>)
      : {};
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Sends an Idempotency-Key so a retry cannot create a second record. */
  idempotent?: boolean;
  idempotencyKey?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT = 20_000;

/**
 * One fetch wrapper for the whole client. It unwraps the { ok, data } envelope,
 * turns a failure into a typed ApiError, and aborts a request that hangs rather
 * than leaving a spinner running indefinitely.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, idempotent, idempotencyKey, timeoutMs = DEFAULT_TIMEOUT, ...init } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(init.headers);
  if (body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (idempotent || idempotencyKey) {
    headers.set('Idempotency-Key', idempotencyKey ?? newIdempotencyKey());
  }

  try {
    const response = await fetch(path, {
      ...init,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: init.signal ?? controller.signal,
      credentials: 'same-origin',
    });

    if (response.status === 204) return undefined as T;

    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.ok === false) {
      const error = payload?.error ?? {};
      throw new ApiError(
        response.status,
        error.code ?? 'INTERNAL',
        error.message ?? 'That request could not be completed',
        error.details,
      );
    }

    return (payload?.data ?? payload) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(408, 'TIMEOUT', 'The request took too long, please try again');
    }
    throw new ApiError(0, 'NETWORK', 'We could not reach the server, please check your connection');
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { idempotent: true, ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};

/** Builds a query string, dropping empty values so URLs stay readable. */
export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const serialised = search.toString();
  return serialised ? `?${serialised}` : '';
}
