import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from '../src/infrastructure/db/client';
import { projects, services, siteSettings } from '../src/infrastructure/db/schema';

/**
 * Points the home page slides and the project covers at the same real
 * photographs the services now use.
 *
 * Installing service images fixed the services page and left the rest of the
 * site on the seeded stock, where a slide reading "We find the water before
 * we drill for it" sat over an aerial of a concrete slab, and a reverse
 * osmosis project was illustrated by a laboratory bench. Reusing what is
 * already in the media library keeps the whole site telling one story and
 * costs no new downloads.
 *
 * Run after `npm run images:services`. Safe to re-run.
 */

/** Home page slide headline fragment -> the service whose photograph fits. */
const SLIDES: { match: RegExp; service: string }[] = [
  { match: /drink|treated|system that is sized/i, service: 'water-treatment' },
  { match: /find the water|survey|drill/i, service: 'geophysical-surveys' },
  { match: /leak|pressure|tested/i, service: 'leak-detection-and-repair' },
];

/** Project title fragment -> the service whose photograph fits. */
const PROJECTS: { match: RegExp; service: string }[] = [
  { match: /reverse osmosis/i, service: 'reverse-osmosis-water-treatment' },
  { match: /community water/i, service: 'community-water-systems' },
  { match: /borehole/i, service: 'borehole-drilling' },
  { match: /solar/i, service: 'solar-water-heater-installation' },
  { match: /plumbing/i, service: 'general-plumbing' },
  { match: /sewage|drain/i, service: 'drainage-works' },
];

async function main() {
  const rows = await db
    .select({ slug: services.slug, hero: services.heroImageUrl })
    .from(services);
  const heroes = new Map(rows.map((r) => [r.slug, r.hero]));

  const heroFor = (slug: string): string | null => {
    const url = heroes.get(slug);
    return url && url.startsWith('/api/media/') ? url : null;
  };

  /* ------------------------------------------------------- home page slides */
  const [settings] = await db.select().from(siteSettings).limit(1);
  if (settings) {
    const slides = (settings.heroSlides ?? []) as { headline?: string; imageUrl?: string }[];
    let changed = false;

    const next = slides.map((slide) => {
      const rule = SLIDES.find((candidate) => candidate.match.test(slide.headline ?? ''));
      const url = rule ? heroFor(rule.service) : null;
      if (!url || url === slide.imageUrl) return slide;
      changed = true;
      console.log(`  slide    ${(slide.headline ?? '').slice(0, 44).padEnd(46)} -> ${rule!.service}`);
      return { ...slide, imageUrl: url };
    });

    if (changed) {
      await db
        .update(siteSettings)
        .set({ heroSlides: next, updatedAt: sql`now()` })
        .where(eq(siteSettings.id, settings.id));
    }
  }

  /* ----------------------------------------------------------- project covers */
  for (const project of await db.select().from(projects)) {
    const rule = PROJECTS.find((candidate) => candidate.match.test(project.title));
    const url = rule ? heroFor(rule.service) : null;
    if (!url || url === project.coverImageUrl) continue;

    await db.update(projects).set({ coverImageUrl: url }).where(eq(projects.id, project.id));
    console.log(`  project  ${project.title.slice(0, 44).padEnd(46)} -> ${rule!.service}`);
  }

  console.log('\nDone. The home page and projects now use the same photographs as the services.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
