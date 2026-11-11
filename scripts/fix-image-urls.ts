import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { normaliseMediaUrl, type HeroSlide } from '../src/core/entities';
import { db, pool } from '../src/infrastructure/db/client';
import { projects, services, siteSettings } from '../src/infrastructure/db/schema';

/**
 * Rewrites stored links to our own media library into relative paths.
 *
 * An address copied out of the media library used to be a full URL. Pasted
 * into a hero image field it looks perfectly correct and shows nothing at
 * all, because `next/image` refuses an absolute URL whose host is not listed
 * in `remotePatterns`, and a site does not list itself.
 *
 * New values are reduced on the way in, so this is only needed once, for
 * whatever was saved before that. Safe to re-run: a path that is already
 * relative is left exactly as it is.
 */
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  let changed = 0;

  const report = (kind: string, label: string, from: string, to: string) => {
    changed += 1;
    console.log(`  ${kind.padEnd(9)} ${label.slice(0, 36).padEnd(38)} ${from}\n  ${''.padEnd(48)}-> ${to}`);
  };

  for (const row of await db.select().from(services)) {
    const hero = normaliseMediaUrl(row.heroImageUrl ?? '');
    const gallery = (row.galleryUrls ?? []).map(normaliseMediaUrl);
    const heroChanged = hero !== (row.heroImageUrl ?? '');
    const galleryChanged = gallery.join('\u0000') !== (row.galleryUrls ?? []).join('\u0000');
    if (!heroChanged && !galleryChanged) continue;

    if (heroChanged) report('service', row.name, row.heroImageUrl ?? '', hero);
    if (galleryChanged) report('service', `${row.name} gallery`, 'absolute entries', 'relative');
    if (!dryRun) {
      await db
        .update(services)
        .set({ heroImageUrl: hero, galleryUrls: gallery })
        .where(eq(services.id, row.id));
    }
  }

  for (const row of await db.select().from(projects)) {
    const cover = normaliseMediaUrl(row.coverImageUrl ?? '');
    const gallery = (row.galleryUrls ?? []).map(normaliseMediaUrl);
    const coverChanged = cover !== (row.coverImageUrl ?? '');
    const galleryChanged = gallery.join('\u0000') !== (row.galleryUrls ?? []).join('\u0000');
    if (!coverChanged && !galleryChanged) continue;

    if (coverChanged) report('project', row.title, row.coverImageUrl ?? '', cover);
    if (galleryChanged) report('project', `${row.title} gallery`, 'absolute entries', 'relative');
    if (!dryRun) {
      await db
        .update(projects)
        .set({ coverImageUrl: cover, galleryUrls: gallery })
        .where(eq(projects.id, row.id));
    }
  }

  const [settings] = await db.select().from(siteSettings).limit(1);
  if (settings) {
    const og = normaliseMediaUrl(settings.ogImageUrl ?? '');
    // The column is jsonb, so Drizzle hands these back untyped.
    const slides = ((settings.heroSlides ?? []) as HeroSlide[]).map((slide) => ({
      ...slide,
      imageUrl: normaliseMediaUrl(slide.imageUrl ?? ''),
    }));
    const ogChanged = og !== (settings.ogImageUrl ?? '');
    const slidesChanged =
      JSON.stringify(slides) !== JSON.stringify(settings.heroSlides ?? []);

    if (ogChanged) report('settings', 'share image', settings.ogImageUrl ?? '', og);
    if (slidesChanged) report('settings', 'hero slides', 'absolute entries', 'relative');
    if ((ogChanged || slidesChanged) && !dryRun) {
      await db
        .update(siteSettings)
        .set({ ogImageUrl: og || null, heroSlides: slides, updatedAt: sql`now()` })
        .where(eq(siteSettings.id, settings.id));
    }
  }

  if (changed === 0) {
    console.log('Every stored image address is already in a form the optimiser accepts.');
    return;
  }
  console.log(
    dryRun
      ? `\n${changed} would be rewritten. Run without --dry-run to apply.`
      : `\n${changed} rewritten.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
