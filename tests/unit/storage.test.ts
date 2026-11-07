import { describe, expect, it } from 'vitest';
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  assertUploadAllowed,
  isPostgresStorageKey,
  probeImageSize,
} from '../../src/core/entities';
import { ValidationError } from '../../src/core/errors';

/**
 * These pin down the two things that went wrong in production: an upload cap
 * larger than the platform would carry, and a key that could only be read by
 * whichever driver happened to be configured at the time.
 */

describe('upload limits', () => {
  it('stays under the 4.5MB a serverless request body may carry', () => {
    // Above this the platform answers with its own 413 before any of our code
    // runs, so the message a person sees cannot be written by us.
    expect(MAX_UPLOAD_BYTES).toBeLessThan(4.5 * 1024 * 1024);
  });

  it('accepts a file at the limit and refuses one past it', () => {
    expect(() => assertUploadAllowed('image/jpeg', MAX_UPLOAD_BYTES)).not.toThrow();
    expect(() => assertUploadAllowed('image/jpeg', MAX_UPLOAD_BYTES + 1)).toThrow(ValidationError);
  });

  it('says what the limit is, in the units the person uploading thinks in', () => {
    expect(() => assertUploadAllowed('image/jpeg', MAX_UPLOAD_BYTES + 1)).toThrow(/4MB/);
  });

  it('refuses an empty file', () => {
    expect(() => assertUploadAllowed('image/png', 0)).toThrow(ValidationError);
  });

  it('refuses a type that is not on the list', () => {
    expect(() => assertUploadAllowed('application/zip', 1024)).toThrow(/application\/zip/);
    expect(() => assertUploadAllowed('text/html', 1024)).toThrow(ValidationError);
  });

  it('allows the image types the site actually renders', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(ALLOWED_UPLOAD_TYPES).toContain(type);
      expect(() => assertUploadAllowed(type, 2048)).not.toThrow();
    }
  });
});

describe('routing a key to the store that holds it', () => {
  it('reads a bare UUID as a Postgres key', () => {
    expect(isPostgresStorageKey('6c3f1a2e-9b7d-4a1c-8e2f-0d5b6a7c8e9f')).toBe(true);
  });

  it('leaves a foldered key to the object store', () => {
    // An asset uploaded while S3 was healthy must stay readable, so this must
    // not be claimed by Postgres just because the driver has since changed.
    expect(isPostgresStorageKey('general/borehole-rig-1a2b3c4d.jpg')).toBe(false);
    expect(isPostgresStorageKey('projects/2026/site-9f8e7d6c.webp')).toBe(false);
  });

  it('is not fooled by a UUID that carries a folder or an extension', () => {
    expect(isPostgresStorageKey('general/6c3f1a2e-9b7d-4a1c-8e2f-0d5b6a7c8e9f')).toBe(false);
    expect(isPostgresStorageKey('6c3f1a2e-9b7d-4a1c-8e2f-0d5b6a7c8e9f.jpg')).toBe(false);
  });
});

describe('reading an image size from its header', () => {
  it('reads a PNG', () => {
    const png = Buffer.alloc(32);
    png.writeUInt32BE(1280, 16);
    png.writeUInt32BE(720, 20);
    expect(probeImageSize(png, 'image/png')).toEqual({ width: 1280, height: 720 });
  });

  it('reads a GIF', () => {
    const gif = Buffer.alloc(16);
    gif.writeUInt16LE(640, 6);
    gif.writeUInt16LE(480, 8);
    expect(probeImageSize(gif, 'image/gif')).toEqual({ width: 640, height: 480 });
  });

  it('returns nothing rather than throwing on bytes it cannot read', () => {
    expect(probeImageSize(Buffer.alloc(4), 'image/png')).toBeNull();
    expect(probeImageSize(Buffer.from('not an image'), 'image/jpeg')).toBeNull();
    expect(probeImageSize(Buffer.alloc(64), 'application/pdf')).toBeNull();
  });
});
