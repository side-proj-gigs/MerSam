import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { poolConfig } from './connection';

/**
 * Migrations run against the direct (non-pooled) Neon endpoint, because the
 * pooler does not support the advisory locks the migrator takes out.
 */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const pool = new Pool(poolConfig(connectionString, { max: 1 }));

  try {
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
    console.log('Migrations applied');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
