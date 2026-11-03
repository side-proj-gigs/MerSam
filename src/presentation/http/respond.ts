import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, isAppError } from '@core/errors';

export interface ApiFailure {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

export function created<T>(data: T, location?: string): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    { ok: true, data },
    { status: 201, headers: location ? { Location: location } : undefined },
  );
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

function zodDetails(error: ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    if (!details[path]) details[path] = issue.message;
  }
  return details;
}

/**
 * Converts anything thrown inside a route into a response. Domain failures keep
 * their message because it was written for the person reading it; anything else
 * is logged in full and reported generically so internals never leak.
 */
export function toErrorResponse(error: unknown): NextResponse<ApiFailure> {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false as const,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Some of the details supplied were not valid',
          details: zodDetails(error),
        },
      },
      { status: 422 },
    );
  }

  if (isAppError(error)) {
    const headers =
      error.code === 'RATE_LIMITED' && typeof error.details === 'object' && error.details
        ? { 'Retry-After': String((error.details as { retryAfterSeconds?: number }).retryAfterSeconds ?? 60) }
        : undefined;

    return NextResponse.json(
      { ok: false as const, error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status, headers },
    );
  }

  console.error('Unhandled route failure', error);
  return NextResponse.json(
    {
      ok: false as const,
      error: { code: 'INTERNAL', message: 'Something went wrong on our side, please try again' },
    },
    { status: 500 },
  );
}

/** Wraps a handler so no route has to repeat the same try and catch. */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export { AppError };
