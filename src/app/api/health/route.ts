import { sql } from 'drizzle-orm';
import { db } from '@infra/db/client';
import { ok, route } from '@/presentation/http/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A readiness probe that actually touches the database. */
export const GET = route(async () => {
  const started = Date.now();
  await db.execute(sql`select 1`);
  return ok({ status: 'ok', database: 'reachable', latencyMs: Date.now() - started });
});
