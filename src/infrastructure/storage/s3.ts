import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { InvariantViolation } from '@core/errors';
import type { FileStorage, StoredFile } from '@app-layer/ports';
import { env } from '../config/env';
import { assertUploadAllowed } from '@core/entities';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
};

let client: S3Client | null = null;

function s3(): S3Client {
  if (client) return client;

  const { endpoint, region, accessKeyId, secretAccessKey, bucket } = env.storage;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new InvariantViolation(
      'S3 storage is selected but the endpoint, bucket or credentials are missing',
    );
  }

  client = new S3Client({
    region: region || 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    // Neon's object store addresses buckets by path rather than by subdomain.
    forcePathStyle: true,
  });
  return client;
}

/** Keeps the original name recognisable while guaranteeing a unique key. */
function buildKey(folder: string, filename: string, mimeType: string): string {
  const safeFolder = folder.replace(/[^a-z0-9/-]/gi, '-').replace(/^-+|-+$/g, '') || 'general';
  const stem =
    filename
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
      .toLowerCase() || 'file';
  const extension = EXTENSIONS[mimeType] ?? 'bin';
  return `${safeFolder}/${stem}-${randomUUID().slice(0, 8)}.${extension}`;
}

/**
 * Whether this driver can actually be used, as a sentence explaining why not.
 *
 * Checked once at startup rather than trusted, because a bucket that has been
 * deleted or a key that has been rotated looks exactly like a working
 * configuration until the first upload fails.
 */
export async function s3Unavailable(): Promise<string | null> {
  const { endpoint, accessKeyId, secretAccessKey, bucket } = env.storage;
  if (!endpoint) return 'S3_ENDPOINT is not set';
  if (!bucket) return 'S3_BUCKET is not set';
  if (!accessKeyId || !secretAccessKey) return 'S3 credentials are not set';

  try {
    await s3().send(new HeadBucketCommand({ Bucket: bucket }));
    return null;
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === 'NoSuchBucket' || name === 'NotFound') {
      return `the bucket "${bucket}" does not exist at ${endpoint}`;
    }
    if (name === 'Forbidden' || name === 'AccessDenied' || name === 'InvalidAccessKeyId') {
      return `the credentials are not accepted for the bucket "${bucket}"`;
    }
    return `${name ?? 'the bucket'} could not be reached: ${(error as Error).message}`;
  }
}

export const s3Storage: FileStorage = {
  async save({ folder, filename, mimeType, data }): Promise<StoredFile> {
    assertUploadAllowed(mimeType, data.byteLength);

    const key = buildKey(folder, filename, mimeType);
    await s3().send(
      new PutObjectCommand({
        Bucket: env.storage.bucket,
        Key: key,
        Body: data,
        ContentType: mimeType,
        // Uploaded media is content-addressed by its unique key, so it can be
        // cached indefinitely. Replacing a file produces a new key.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return { key, byteSize: data.byteLength, mimeType };
  },

  async read(key: string) {
    try {
      const result = await s3().send(
        new GetObjectCommand({ Bucket: env.storage.bucket, Key: key }),
      );
      if (!result.Body) return null;
      const bytes = await result.Body.transformToByteArray();
      return {
        data: Buffer.from(bytes),
        mimeType: result.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      // A missing key is an expected outcome, not a failure worth throwing on.
      if ((error as { name?: string }).name === 'NoSuchKey') return null;
      throw error;
    }
  },

  async remove(key: string): Promise<void> {
    await s3().send(new DeleteObjectCommand({ Bucket: env.storage.bucket, Key: key }));
  },
};
