import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { probeImageSize } from '../src/core/entities';
import { db, pool } from '../src/infrastructure/db/client';
import { createRepositories } from '../src/infrastructure/repositories';
import { postgresStorage } from '../src/infrastructure/storage';
import { services } from '../src/infrastructure/db/schema';
import { IMAGE_CREDITS } from '../src/lib/image-credits';

/**
 * Puts a real photograph of real work behind every service.
 *
 * The seeded images came from a stock library and showed chemists in lab
 * coats, an eye behind safety goggles and a utility scale solar farm. None of
 * that is what a water engineering and plumbing contractor does, and a
 * prospective client looking at the services page could see that immediately.
 *
 * These are downloaded into the media library rather than hot linked, so the
 * site serves its own copies: they go through the image optimiser, they do
 * not depend on another service staying up, and the office can swap any of
 * them from the Media page afterwards.
 *
 * Safe to re-run. An image already installed is recognised by its alt text
 * and left alone.
 *
 *   npm run images:services            apply
 *   npm run images:services -- --force replace what is already there
 */

const UA = 'MerSam-SiteBuilder/1.0 (service imagery install)';
const WIDTH = 1600;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Asks Commons for a sized render of a file.
 *
 * Retried, because a dozen requests in quick succession is enough to be
 * throttled, and a throttled lookup silently left two services on their old
 * photograph the first time this ran.
 */
async function commonsUrl(file: string): Promise<string | null> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query', titles: `File:${file}`, prop: 'imageinfo',
    iiprop: 'url', iiurlwidth: String(WIDTH), format: 'json',
  }).toString();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await wait(1500 * attempt);
    try {
      const response = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!response.ok) continue;
      const data = (await response.json()) as {
        query?: { pages?: Record<string, { imageinfo?: { thumburl?: string }[] }> };
      };
      const page = Object.values(data.query?.pages ?? {})[0];
      const thumb = page?.imageinfo?.[0]?.thumburl;
      if (thumb) return thumb;
    } catch {
      // Retried below.
    }
  }
  return null;
}

async function main() {
  const force = process.argv.includes('--force');
  const repos = createRepositories(db);
  let installed = 0;
  let skipped = 0;

  for (const credit of IMAGE_CREDITS) {
    const [service] = await db.select().from(services).where(eq(services.slug, credit.slug));
    if (!service) {
      console.log(`  skip     ${credit.slug.padEnd(42)} no such service`);
      continue;
    }

    // Already pointing at a library image, and not asked to replace it.
    if (!force && service.heroImageUrl?.startsWith('/api/media/')) {
      skipped += 1;
      console.log(`  keep     ${credit.slug.padEnd(42)} already uses the media library`);
      continue;
    }

    await wait(400);
    const source = await commonsUrl(credit.file);
    if (!source) {
      console.log(`  FAILED   ${credit.slug.padEnd(42)} could not resolve ${credit.file}`);
      continue;
    }

    const response = await fetch(source, { headers: { 'User-Agent': UA } });
    if (!response.ok) {
      console.log(`  FAILED   ${credit.slug.padEnd(42)} download returned ${response.status}`);
      continue;
    }

    const data = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
    const stored = await postgresStorage.save({
      folder: 'services',
      filename: credit.file,
      mimeType,
      data,
    });

    const id = randomUUID();
    const dimensions = probeImageSize(data, mimeType);
    await repos.media.create({
      id,
      url: `/api/media/${id}/raw`,
      thumbnailUrl: null,
      altText: credit.caption,
      mimeType: stored.mimeType,
      byteSize: stored.byteSize,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      folder: 'services',
      storageKey: stored.key,
      uploadedBy: null,
      source: 'upload',
    });

    await db
      .update(services)
      .set({ heroImageUrl: `/api/media/${id}/raw` })
      .where(eq(services.id, service.id));

    installed += 1;
    console.log(
      `  ok       ${credit.slug.padEnd(42)} ${String(Math.round(data.byteLength / 1024)).padStart(5)} KB  ${dimensions?.width}x${dimensions?.height}  [${credit.licence}]`,
    );
  }

  console.log(`\n${installed} installed, ${skipped} left as they were.`);
  if (installed > 0) {
    console.log('Credits for the Creative Commons images are published at /credits.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
