import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db, pool } from '../src/infrastructure/db/client';

/** Clears the login and enquiry counters so a test run starts from zero. */
async function main() {
  await db.execute(sql`delete from rate_limit_buckets`);
  await db.execute(sql`delete from idempotency_keys`);
  console.log('rate limit and idempotency tables cleared');
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
