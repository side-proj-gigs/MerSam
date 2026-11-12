import { randomUUID } from 'node:crypto';
import { cache as reactCache } from 'react';
import bcrypt from 'bcryptjs';
import { and, eq, lt, sql } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { env } from '../config/env';
import { db } from '../db/client';
import { idempotencyKeys, rateLimitBuckets } from '../db/schema';
import type {
  Cache,
  Clock,
  IdempotencyLookup,
  IdempotencyStore,
  IdGenerator,
  PasswordHasher,
  RateLimiter,
  SessionToken,
  TokenService,
} from '@app-layer/ports';

export const systemClock: Clock = {
  now: () => new Date(),
};

export const uuidGenerator: IdGenerator = {
  next: () => randomUUID(),
};

/* ----------------------------------------------------------- passwords */

const BCRYPT_ROUNDS = 12;

export const bcryptHasher: PasswordHasher = {
  hash: (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS),
  verify: async (plain, hash) => {
    try {
      return await bcrypt.compare(plain, hash);
    } catch {
      return false;
    }
  },
};

/* --------------------------------------------------------------- tokens */

const secretKey = new TextEncoder().encode(env.authSecret);

export const joseTokens: TokenService = {
  async issue(payload, ttlSeconds): Promise<SessionToken> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('mersam')
      .setAudience('mersam-admin')
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(secretKey);
    return { token, expiresAt };
  },

  async verify<T>(token: string): Promise<T | null> {
    try {
      const { payload } = await jwtVerify(token, secretKey, {
        issuer: 'mersam',
        audience: 'mersam-admin',
      });
      return payload as T;
    } catch {
      return null;
    }
  },
};

/* ---------------------------------------------------------------- cache */

/**
 * The read through cache in front of the public content queries, scoped to one
 * request.
 *
 * This was one map per process with a five minute expiry, which looked like a
 * free win and was half of a real bug. A write only ever flushed the instance
 * that served it, so any other serverless instance went on answering from its
 * own copy. Worse, because the public pages are prerendered, whatever a
 * regeneration happened to read was then frozen into the page cache for
 * another window, so an edit could stay invisible for longer than either
 * expiry suggested, with nothing in the browser to clear.
 *
 * Scoping it to the request keeps the part that was earning its keep: one
 * render of the home page asks for the settings and the services several times
 * over, and those still collapse into a single query each. What it gives up is
 * reuse between requests, which the prerendered pages already provide, and
 * which can be flushed on demand where this could not.
 *
 * React's cache() supplies the scope. Per the Next documentation it is "scoped
 * to the current request only. Each request gets its own memoization scope
 * with no sharing between requests."
 */
const requestStore = reactCache((): Map<string, unknown> => new Map());

/**
 * Outside a request there is no scope to attach to, which is the case in the
 * maintenance scripts and in tests. A throwaway map is the honest answer: every
 * read then goes to the database, which is what a script wants anyway.
 */
function store(): Map<string, unknown> {
  try {
    return requestStore();
  } catch {
    return new Map();
  }
}

export const requestCache: Cache = {
  async get<T>(key: string): Promise<T | null> {
    const hit = store().get(key);
    // undefined is the miss. A stored null is a value the loader returned.
    return hit === undefined ? null : (hit as T);
  },

  /** The expiry is ignored deliberately: an entry cannot outlive its request. */
  async set<T>(key: string, value: T): Promise<void> {
    store().set(key, value);
  },

  async delete(key: string): Promise<void> {
    store().delete(key);
  },

  async deleteByPrefix(prefix: string): Promise<void> {
    const map = store();
    for (const key of [...map.keys()]) {
      if (key.startsWith(prefix)) map.delete(key);
    }
  },
};

/**
 * Drops the cached reads for the rest of this request, so anything the handler
 * does after a write sees the new row rather than the one it loaded earlier.
 *
 * This says nothing about the prerendered pages. Those are expired separately
 * by revalidatePublicSite in the presentation layer, which is what makes an
 * edit visible to the public site.
 */
export async function invalidateContentCache(prefix?: string): Promise<void> {
  await requestCache.deleteByPrefix(prefix ?? '');
}

/* ---------------------------------------------------------- idempotency */

const IDEMPOTENCY_TTL_HOURS = 24;

/**
 * Backed by a unique index on (key, scope). The insert either wins the race and
 * reserves the key, or collides and tells the caller what the first attempt is
 * doing. Replays of a completed call return the original response body.
 */
export const pgIdempotency: IdempotencyStore = {
  async reserve(key, scope) {
    const inserted = await db
      .insert(idempotencyKeys)
      .values({ key, scope, status: 'in_flight' })
      .onConflictDoNothing({ target: [idempotencyKeys.key, idempotencyKeys.scope] })
      .returning({ key: idempotencyKeys.key });

    if (inserted.length > 0) return 'reserved';

    const [existing] = await db
      .select({ status: idempotencyKeys.status })
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.scope, scope)))
      .limit(1);

    return existing?.status === 'completed' ? 'completed' : 'in_flight';
  },

  async complete(key, scope, response) {
    await db
      .update(idempotencyKeys)
      .set({ status: 'completed', response, completedAt: new Date() })
      .where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.scope, scope)));
  },

  async lookup(key, scope): Promise<IdempotencyLookup> {
    const [row] = await db
      .select({ status: idempotencyKeys.status, response: idempotencyKeys.response })
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.scope, scope)))
      .limit(1);

    if (!row) return null;
    return row.status === 'completed'
      ? { status: 'completed', response: row.response }
      : { status: 'in_flight' };
  },

  async release(key, scope) {
    await db
      .delete(idempotencyKeys)
      .where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.scope, scope)));
  },
};

/** Housekeeping for the two tables that accumulate short-lived rows. */
export async function pruneExpiredKeys(): Promise<void> {
  const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_HOURS * 3600 * 1000);
  await db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, cutoff));
  await db
    .delete(rateLimitBuckets)
    .where(lt(rateLimitBuckets.windowStart, new Date(Date.now() - 3600 * 1000)));
}

/* ---------------------------------------------------------- rate limits */

/**
 * A fixed window counter held in Postgres so every serverless instance shares
 * one budget. One upsert per call, no read-then-write race.
 */
export const pgRateLimiter: RateLimiter = {
  async consume(key, limit, windowSeconds) {
    const now = new Date();
    const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);

    const [row] = await db
      .insert(rateLimitBuckets)
      .values({ key, hits: 1, windowStart })
      .onConflictDoUpdate({
        target: rateLimitBuckets.key,
        set: {
          hits: sql`case when ${rateLimitBuckets.windowStart} < ${windowStart.toISOString()} then 1 else ${rateLimitBuckets.hits} + 1 end`,
          windowStart: sql`case when ${rateLimitBuckets.windowStart} < ${windowStart.toISOString()} then ${windowStart.toISOString()}::timestamptz else ${rateLimitBuckets.windowStart} end`,
        },
      })
      .returning({ hits: rateLimitBuckets.hits });

    const hits = row?.hits ?? 1;
    const retryAfter = Math.max(
      1,
      Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000),
    );
    return { allowed: hits <= limit, retryAfter };
  },
};
