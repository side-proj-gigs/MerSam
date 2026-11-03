import { randomUUID } from 'node:crypto';
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

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * An in-process cache with a hard entry cap. It sits in front of the read-heavy
 * public queries (services, settings, testimonials) so a burst of visitors
 * hits Postgres once rather than once per request. Each serverless instance
 * keeps its own copy, which is fine for content that changes a few times a day
 * and is invalidated explicitly whenever the admin saves.
 */
class MemoryCache implements Cache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly maxEntries = 500;

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    // Refresh recency so the eviction below drops genuinely cold keys.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next();
      if (!oldest.done) this.store.delete(oldest.value);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

const globalForCache = globalThis as unknown as { __mersamCache?: Cache };
export const memoryCache: Cache = globalForCache.__mersamCache ?? new MemoryCache();
if (env.nodeEnv !== 'production') globalForCache.__mersamCache = memoryCache;

export const CACHE_KEYS = {
  settings: 'settings:site',
  servicesActive: 'services:active',
  serviceBySlug: (slug: string) => `services:slug:${slug}`,
  testimonials: 'testimonials:published',
  projects: 'projects:published',
  faqs: 'faqs:published',
} as const;

/** Called whenever the admin writes content, so the next read rebuilds. */
export async function invalidateContentCache(prefix?: string): Promise<void> {
  if (prefix) {
    await memoryCache.deleteByPrefix(prefix);
    return;
  }
  await Promise.all([
    memoryCache.deleteByPrefix('settings:'),
    memoryCache.deleteByPrefix('services:'),
    memoryCache.deleteByPrefix('testimonials:'),
    memoryCache.deleteByPrefix('projects:'),
    memoryCache.deleteByPrefix('faqs:'),
  ]);
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
