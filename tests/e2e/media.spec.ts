import { deflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { MAX_UPLOAD_BYTES as MAX_BYTES } from '../../src/core/entities/media';
import { ADMIN_STATE } from './auth-state';

/**
 * Media upload, which had no coverage at all and was broken in production for
 * it. Two things are checked that no unit test can: that a file picked in the
 * browser reaches the database, and that the bytes come back out again
 * through the route the rest of the site links to.
 */

/**
 * A real PNG of the given size, so the type check and the dimension probe
 * both see valid bytes. `noisy` fills it with random pixels, which deflate
 * refuses to compress, giving a genuinely oversized file.
 */
function png(width: number, height: number, noisy = false): Buffer {
  const chunk = (tag: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(tag, 'ascii'), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crcTable = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
    let crc = 0xffffffff;
    for (const byte of body) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, body, checksum]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour

  const stride = 1 + width * 3;
  const raw = Buffer.alloc(height * stride);
  if (noisy) {
    for (let row = 0; row < height; row += 1) {
      // Leave the filter byte at 0 and randomise the pixels after it.
      for (let i = 1; i < stride; i += 1) raw[row * stride + i] = (Math.random() * 256) | 0;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

test.describe('media library', () => {
  test.use({ storageState: ADMIN_STATE });

  test('the readiness probe reports which store uploads go to', async ({ page }) => {
    const response = await page.request.get('/api/health');
    expect(response.status()).toBe(200);

    const { data } = await response.json();
    expect(data.database).toBe('reachable');

    // Whatever is configured, something has to be able to accept an upload.
    expect(['postgres', 's3']).toContain(data.storage.active);
    // A degraded store must say why, or nobody can act on it.
    if (data.storage.degraded) expect(data.storage.reason).toBeTruthy();
  });

  test('a picked file uploads and its bytes come back out', async ({ page }) => {
    await page.goto('/admin/media');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Media/i);

    const name = `e2e-upload-${Date.now()}.png`;
    const bytes = png(48, 32);

    await page.setInputFiles('input[type=file]', {
      name,
      mimeType: 'image/png',
      buffer: bytes,
    });

    await expect(page.getByText(/1 file uploaded/i)).toBeVisible({ timeout: 30_000 });

    // Find the row the upload created, and prove the stored bytes are served.
    const listed = await page.request.get('/api/admin/media?page=1&pageSize=24');
    expect(listed.status()).toBe(200);
    const { data } = await listed.json();

    const alt = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    const asset = data.items.find((item: { altText: string }) => item.altText === alt);
    expect(asset, 'the uploaded asset should appear in the library').toBeTruthy();

    expect(asset.source).toBe('upload');
    expect(asset.mimeType).toBe('image/png');
    expect(asset.byteSize).toBe(bytes.byteLength);
    // Read straight out of the header, so a wrong answer means wrong bytes.
    expect(asset.width).toBe(48);
    expect(asset.height).toBe(32);

    const raw = await page.request.get(asset.url);
    expect(raw.status()).toBe(200);
    expect(raw.headers()['content-type']).toContain('image/png');
    expect(Buffer.from(await raw.body()).equals(bytes)).toBe(true);

    // Clean up after itself: this runs against a real database.
    const removed = await page.request.delete(`/api/admin/media/${asset.id}`, {
      timeout: 60_000,
    });
    expect(removed.status()).toBe(204);
    expect((await page.request.get(asset.url)).status()).toBe(404);
  });

  test('a file past the limit is refused with a reason, not a shrug', async ({ page }) => {
    await page.goto('/admin/media');

    // A PDF cannot be shrunk in the browser, so it exercises the refusal path
    // rather than the resize path.
    await page.setInputFiles('input[type=file]', {
      name: 'oversized.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(5 * 1024 * 1024, 0x25),
    });

    await expect(page.getByText(/oversized\.pdf is 5\.0MB/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/must be under 4\.0MB/i)).toBeVisible();
  });

  test('an oversized photograph is shrunk in the browser rather than refused', async ({ page }) => {
    // Re-encoding a multi-megapixel image in the browser is slow on purpose:
    // this is the worst case the resize path has to survive.
    test.setTimeout(120_000);
    await page.goto('/admin/media');

    const name = `e2e-large-${Date.now()}.png`;
    // Wider than the 2400px cap and, being pure noise, far past 4MB.
    const buffer = png(2600, 1200, true);
    expect(buffer.byteLength).toBeGreaterThan(MAX_BYTES);

    await page.setInputFiles('input[type=file]', { name, mimeType: 'image/png', buffer });

    await expect(page.getByText(/was resized to fit/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/1 file uploaded/i)).toBeVisible({ timeout: 60_000 });

    const listed = await page.request.get('/api/admin/media?page=1&pageSize=24', {
      timeout: 60_000,
    });
    const { data } = await listed.json();
    const alt = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    const asset = data.items.find((item: { altText: string }) => item.altText === alt);

    expect(asset, 'the resized photograph should have been stored').toBeTruthy();
    expect(asset.byteSize).toBeLessThanOrEqual(MAX_BYTES);
    // The longest edge is capped, which is what brought it under the limit.
    expect(asset.width).toBeLessThanOrEqual(2400);
    // An opaque PNG is re-encoded as JPEG, which is what makes it fit at all.
    expect(asset.mimeType).toBe('image/jpeg');

    await page.request.delete(`/api/admin/media/${asset.id}`, { timeout: 60_000 });
  });
});
