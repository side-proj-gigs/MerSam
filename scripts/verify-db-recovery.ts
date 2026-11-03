import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db, pool } from '../src/infrastructure/db/client';

/**
 * Proves the pool survives having its connections killed underneath it, which
 * is what a Neon scale-to-zero does. Without the retry and the pool error
 * handler this script either throws or takes the process down.
 */
async function main() {
  const before = await db.execute(sql`select count(*)::int as n from services`);
  console.log('1. baseline query ok, services =', (before.rows ?? before)[0]);

  // Terminate every other backend this role owns, which is as close to a Neon
  // suspend as we can get on demand.
  const killed = await db.execute(sql`
    select pg_terminate_backend(pid) from pg_stat_activity
    where pid <> pg_backend_pid() and usename = current_user
  `);
  console.log('2. terminated', ((killed.rows ?? killed) as unknown[]).length, 'backend connections');

  // Give the pool a moment to notice the sockets are gone.
  await new Promise((resolve) => setTimeout(resolve, 600));

  const after = await db.execute(sql`select count(*)::int as n from services`);
  console.log('3. query after the kill ok, services =', (after.rows ?? after)[0]);

  const card = await db.execute(
    sql`select name from users where card_slug = 'mersam-administrator'`,
  );
  console.log('4. the card query that failed now ok:', JSON.stringify((card.rows ?? card)));

  console.log('\nRECOVERY VERIFIED');
}

main()
  .catch((error) => {
    console.error('RECOVERY FAILED:', (error as Error).message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
