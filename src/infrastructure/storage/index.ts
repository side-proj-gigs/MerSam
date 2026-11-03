import { createHash, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { ValidationError } from '@core/errors';
import type { FileStorage, StoredFile } from '@app-layer/ports';
import { env } from '../config/env';
import { db } from '../db/client';
import { mediaBlobs } from '../db/schema';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
] as const;

export function assertUploadAllowed(mimeType: string, byteSize: number): void {
  if (!ALLOWED_UPLOAD_TYPES.includes(mimeType as (typeof ALLOWED_UPLOAD_TYPES)[number])) {
    throw new ValidationError(`Files of type ${mimeType} cannot be uploaded`);
  }
  if (byteSize <= 0) throw new ValidationError('The uploaded file is empty');
  if (byteSize > MAX_UPLOAD_BYTES) {
    throw new ValidationError(`Files must stay under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB`);
  }
}

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

/** Reads the intrinsic size out of the header bytes, without an image library. */
export function probeImageSize(
  data: Buffer,
  mimeType: string,
): { width: number; height: number } | null {
  try {
    if (mimeType === 'image/png' && data.length > 24) {
      return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
    }
    if (mimeType === 'image/gif' && data.length > 10) {
      return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
    }
    if (mimeType === 'image/jpeg') {
      let offset = 2;
      while (offset < data.length - 9) {
        if (data[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = data[offset + 1]!;
        // SOF0 through SOF15, skipping the markers that are not frame headers.
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) };
        }
        offset += 2 + data.readUInt16BE(offset + 2);
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Chooses the driver once. If S3 is selected but misconfigured we fall back to
 * Postgres rather than leaving the admin unable to upload anything at all.
 */
export async function resolveStorage(): Promise<FileStorage> {
  if (env.storage.driver !== 's3') return postgresStorage;
  try {
    const { s3Storage } = await import('./s3');
    return s3Storage;
  } catch (error) {
    console.error('S3 storage unavailable, falling back to Postgres', error);
    return postgresStorage;
  }
}
