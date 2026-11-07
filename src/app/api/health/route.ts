import { sql } from 'drizzle-orm';
import { db } from '@infra/db/client';
import { storageStatus } from '@infra/storage';
import { ok, route } from '@/presentation/http/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A readiness probe that actually touches the database, and reports which
 * store uploads are going to.
 *
 * The storage line is here because a bucket that has stopped existing looks
 * exactly like a healthy deployment from the outside, right up until somebody
 * tries to upload a photograph.
 */
export const GET = route(async () => {
  const started = Date.now();
  const [, storage] = await Promise.all([db.execute(sql`select 1`), storageStatus()]);

  return ok({
    status: 'ok',
    database: 'reachable',
    latencyMs: Date.now() - started,
    storage,
  });
});
