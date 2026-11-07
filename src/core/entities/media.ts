import { ValidationError } from '../errors';

/**
 * The rules about what may be uploaded.
 *
 * These live in the domain rather than beside a storage driver because they
 * are the same whichever store the bytes end up in, and because the browser,
 * the route and the tests all need to agree on them.
 */

/**
 * Four megabytes, not eight.
 *
 * A serverless request body on Vercel is capped at 4.5MB: the platform
 * answers anything larger with its own plain text 413 before our code runs,
 * so no message we write would ever be seen. The limit has to sit below that,
 * leaving room for the multipart envelope wrapped around the bytes.
 *
 * A larger photograph is not refused outright. It is shrunk in the browser
 * first, which is what someone uploading a picture from a phone expects to
 * happen anyway.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
] as const;

export type UploadType = (typeof ALLOWED_UPLOAD_TYPES)[number];

export function assertUploadAllowed(mimeType: string, byteSize: number): void {
  if (!ALLOWED_UPLOAD_TYPES.includes(mimeType as UploadType)) {
    throw new ValidationError(`Files of type ${mimeType} cannot be uploaded`);
  }
  if (byteSize <= 0) throw new ValidationError('The uploaded file is empty');
  if (byteSize > MAX_UPLOAD_BYTES) {
    throw new ValidationError(
      `Files must stay under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB`,
    );
  }
}

const UUID_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a storage key was written by the Postgres store.
 *
 * Postgres keys are bare UUIDs; an object store key always carries a folder
 * and an extension. Reading the store out of the key is what keeps media
 * uploaded under one driver readable after the configuration changes
 * underneath it, which is precisely when a broken image is least welcome.
 */
export function isPostgresStorageKey(key: string): boolean {
  return UUID_KEY.test(key);
}

/**
 * Reads the intrinsic size out of the header bytes, without an image library.
 *
 * Returns null rather than throwing: a dimension is useful to have and not
 * worth failing an upload over.
 */
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
