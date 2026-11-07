import { createHash, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { assertUploadAllowed, isPostgresStorageKey } from '@core/entities';
import type { FileStorage, StoredFile } from '@app-layer/ports';
import { env } from '../config/env';
import { db } from '../db/client';
import { mediaBlobs } from '../db/schema';

// The upload rules live in the domain. Re-exported here so callers that
// think of them as part of storage keep working.
export {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  assertUploadAllowed,
  probeImageSize,
} from '@core/entities';

/**
 * Keeps bytes in Neon alongside everything else. Used when no object store is
 * configured, and as the fallback if the S3 driver cannot be constructed.
 */
export const postgresStorage: FileStorage = {
  async save({ mimeType, data }): Promise<StoredFile> {
    assertUploadAllowed(mimeType, data.byteLength);
    const key = randomUUID();
    await db.insert(mediaBlobs).values({
      id: key,
      data,
      checksum: createHash('sha256').update(data).digest('hex'),
      mimeType,
    });
    return { key, byteSize: data.byteLength, mimeType };
  },

  async read(key) {
    const [row] = await db
      .select({ data: mediaBlobs.data, mimeType: mediaBlobs.mimeType })
      .from(mediaBlobs)
      .where(eq(mediaBlobs.id, key))
      .limit(1);
    return row ? { data: row.data, mimeType: row.mimeType } : null;
  },

  async remove(key) {
    await db.delete(mediaBlobs).where(eq(mediaBlobs.id, key));
  },
};

/**
 * Which store a key belongs to, read from the key itself.
 *
 * Without this, an asset uploaded while S3 was healthy becomes unreadable
 * the moment the driver falls back, which is exactly when it matters most
 * that the site keeps rendering its images.
 */
export function storageForKey(key: string): FileStorage | null {
  return isPostgresStorageKey(key) ? postgresStorage : null;
}

/**
 * Decided once per process, then cached.
 *
 * The previous version wrapped only the dynamic import, which all but never
 * throws. A missing bucket or a bad key fails much later, inside `save`, so
 * the fallback this function promised never actually ran and a dead bucket
 * surfaced as "something went wrong on our side" on every single upload. That
 * is what happened in production: the Neon bucket was gone and nothing said
 * so.
 *
 * The driver is now asked whether it can really reach its bucket before it is
 * handed out. Postgres is always there to fall back to, so the admin can
 * always upload something, even on a day the object store cannot be reached.
 */
let resolved: Promise<FileStorage> | null = null;

async function chooseStorage(): Promise<FileStorage> {
  if (env.storage.driver !== 's3') return postgresStorage;

  try {
    const { s3Storage, s3Unavailable } = await import('./s3');
    const reason = await s3Unavailable();
    if (!reason) return s3Storage;

    console.error(`[storage] S3 is selected but not usable (${reason}). Falling back to Postgres.`);
    return postgresStorage;
  } catch (error) {
    console.error('[storage] S3 driver could not be loaded, falling back to Postgres', error);
    return postgresStorage;
  }
}

export async function resolveStorage(): Promise<FileStorage> {
  resolved ??= chooseStorage();
  return resolved;
}

/**
 * Reads a stored file, asking the store that key belongs to rather than
 * whichever driver happens to be configured now.
 */
export async function readStoredFile(
  key: string,
): Promise<{ data: Buffer; mimeType: string } | null> {
  const byKey = storageForKey(key);
  if (byKey) return byKey.read(key);

  const storage = await resolveStorage();
  // The key belongs to an object store. If we have fallen back to Postgres
  // there is nothing to read, and saying so beats a confusing empty response.
  if (storage === postgresStorage) return null;
  return storage.read(key);
}

/**
 * What the storage layer actually settled on, for the readiness probe.
 *
 * Worth reporting because the failure this exists to describe, a bucket that
 * has quietly stopped existing, is invisible from the outside until somebody
 * tries to upload something.
 */
export async function storageStatus(): Promise<{
  configured: 'local' | 's3';
  active: 'postgres' | 's3';
  degraded: boolean;
  reason: string | null;
}> {
  if (env.storage.driver !== 's3') {
    return { configured: 'local', active: 'postgres', degraded: false, reason: null };
  }

  const { s3Unavailable } = await import('./s3');
  const reason = await s3Unavailable();

  return {
    configured: 's3',
    active: reason ? 'postgres' : 's3',
    degraded: Boolean(reason),
    reason,
  };
}

/** Removes a stored file from the store its key belongs to. */
export async function removeStoredFile(key: string): Promise<void> {
  const byKey = storageForKey(key);
  if (byKey) return byKey.remove(key);

  const storage = await resolveStorage();
  // Nothing to remove if the object store this key belongs to is unreachable.
  if (storage === postgresStorage) return;
  return storage.remove(key);
}

/** Only used by tests, which need each case to start from a clean decision. */
export function resetStorageChoice(): void {
  resolved = null;
}
