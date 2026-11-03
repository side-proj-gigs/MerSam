import 'dotenv/config';
import { Pool } from 'pg';

/**
 * Confirms the database certificate is signed by a CA Node already trusts.
 * If this passes there is no reason to turn certificate verification off, and
 * turning it off would leave the connection encrypted but unauthenticated.
 */
async function probe(label: string, rejectUnauthorized: boolean) {
  const raw = process.env.DATABASE_URL!;
  const url = new URL(raw);
  url.searchParams.delete('sslmode');
  url.searchParams.delete('channel_binding');

  const pool = new Pool({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized },
    max: 1,
    connectionTimeoutMillis: 15_000,
  });

  try {
    const result = await pool.query('select current_database() as db, version() as v');
    console.log(`  ${label}: OK  db=${result.rows[0].db}  ${String(result.rows[0].v).slice(0, 30)}`);
    return true;
  } catch (error) {
    console.log(`  ${label}: FAILED  ${(error as Error).message}`);
    return false;
  } finally {
    await pool.end();
  }
}

const verified = await probe('certificate verified  ', true);
await probe('certificate unverified', false);
console.log(
  verified
    ? '\nVerification works. rejectUnauthorized must stay true.'
    : '\nVerification fails against the system CA store.',
);
