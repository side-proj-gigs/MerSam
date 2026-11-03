import { NextResponse } from 'next/server';
import { ConflictError, ValidationError } from '@core/errors';
import { getContainer } from '@infra/container';

export const IDEMPOTENCY_HEADER = 'idempotency-key';

const KEY_SHAPE = /^[A-Za-z0-9_:-]{8,128}$/;

/**
 * Wraps a write so a retried request cannot run it twice. The first call
 * reserves the key and stores its response; a replay with the same key gets
 * that stored response back, and a request arriving while the first is still
 * running is rejected with a conflict rather than racing it.
 *
 * Callers without a key run normally, so the header is opt-in for clients that
 * want the guarantee (the admin forms all send one).
 */
export async function withIdempotency<T>(
  request: Request,
  scope: string,
  run: () => Promise<{ status: number; body: T }>,
): Promise<NextResponse> {
  const key = request.headers.get(IDEMPOTENCY_HEADER)?.trim();

  if (!key) {
    const result = await run();
    return NextResponse.json({ ok: true, data: result.body }, { status: result.status });
  }

  if (!KEY_SHAPE.test(key)) {
    throw new ValidationError(
      'The Idempotency-Key header must be 8 to 128 characters of letters, digits, dash, underscore or colon',
    );
  }

  const { idempotency } = getContainer();
  const reservation = await idempotency.reserve(key, scope);

  if (reservation === 'completed') {
    const stored = await idempotency.lookup(key, scope);
    if (stored?.status === 'completed') {
      return NextResponse.json(
        { ok: true, data: stored.response },
        { status: 200, headers: { 'Idempotency-Replayed': 'true' } },
      );
    }
  }

  if (reservation === 'in_flight') {
    throw new ConflictError('An identical request is still being processed');
  }

  try {
    const result = await run();
    await idempotency.complete(key, scope, result.body);
    return NextResponse.json({ ok: true, data: result.body }, { status: result.status });
  } catch (error) {
    // A failed attempt must not block a corrected retry under the same key.
    await idempotency.release(key, scope);
    throw error;
  }
}
