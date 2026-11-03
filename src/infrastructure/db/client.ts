import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient, type QueryResult } from 'pg';
import { env } from '../config/env';
import { isNeon, poolConfig } from './connection';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

/**
 * Neon scales its compute to zero after a period of inactivity, which closes
 * every connection the pool is holding. The next query on one of those sockets
 * fails even though nothing is wrong with the database or the query.
 *
 * These are the error signatures that means, as opposed to a real fault. A
 * constraint violation or a syntax error must never be retried.
 */
const TRANSIENT_CODES = new Set([
  '57P01', // admin_shutdown, which is what Neon sends when it suspends
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now, sent while the compute is waking
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'ENOTFOUND',
]);

const TRANSIENT_MESSAGES = [
  'connection terminated',
  'connection closed',
  'server closed the connection',
  'timeout exceeded when trying to connect',
  'client has encountered a connection error',
];

function isTransient(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = (error as { code?: string }).code;
  if (code && TRANSIENT_CODES.has(code)) return true;

  const message = String((error as { message?: string }).message ?? '').toLowerCase();
  if (TRANSIENT_MESSAGES.some((fragment) => message.includes(fragment))) return true;

  // Drizzle wraps the driver error, so the real cause is one level down.
  const cause = (error as { cause?: unknown }).cause;
  return cause ? isTransient(cause) : false;
}

const MAX_ATTEMPTS = 3;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Next reloads modules on every edit in development, so the pool is parked on
 * globalThis. Without that each save would open a fresh set of connections and
 * exhaust the Neon compute within a few minutes of editing.
 */
const globalForDb = globalThis as unknown as { __mersamPool?: Pool; __mersamDb?: Database };

function createPool(): Pool {
  const connectionString = env.databaseUrl;

  const pool = new Pool(
    poolConfig(connectionString, {
      // Neon terminates idle connections itself, so a small pool with an idle
      // timeout shorter than its suspend window keeps serverless invocations
      // from holding sockets that are about to be closed underneath them.
      max: isNeon(connectionString) ? 10 : 20,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 15_000,
    }),
  );

  // An error on an idle client is emitted on the pool. Without this listener
  // Node treats it as unhandled and takes the process down, which turns a
  // routine Neon suspend into an outage.
  pool.on('error', (error) => {
    console.error('[db] idle client error, the pool will replace it:', error.message);
  });

  return withRetries(pool);
}

/**
 * Retries a query once or twice when the failure is a dropped connection.
 * The first attempt after a suspend fails, the pool discards the dead socket,
 * and the retry opens a fresh one. Anything that is not a connection problem
 * is rethrown immediately.
 */
function withRetries(pool: Pool): Pool {
  const originalQuery = pool.query.bind(pool) as (...args: unknown[]) => Promise<QueryResult>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pool as any).query = async (...args: unknown[]) => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        return await originalQuery(...args);
      } catch (error) {
        lastError = error;
        if (!isTransient(error) || attempt === MAX_ATTEMPTS) throw error;

        // Short backoff: a suspended Neon compute wakes in well under a second.
        await wait(attempt * 250);
        console.warn(`[db] transient connection error, retrying (${attempt}/${MAX_ATTEMPTS - 1})`);
      }
    }

    throw lastError;
  };

  return pool;
}

export const pool: Pool = globalForDb.__mersamPool ?? createPool();
export const db: Database = globalForDb.__mersamDb ?? drizzle(pool, { schema, casing: 'snake_case' });

if (env.nodeEnv !== 'production') {
  globalForDb.__mersamPool = pool;
  globalForDb.__mersamDb = db;
}

/** Checks out a client and guarantees it goes back, even on failure. */
export async function withClient<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await work(client);
  } finally {
    client.release();
  }
}

export { schema, isTransient };
