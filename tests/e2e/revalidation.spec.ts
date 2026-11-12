import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './auth-state';

/**
 * That a saved change is actually visible on the public site, and that saving
 * one field leaves the others alone.
 *
 * Neither had coverage, and between them they hid two faults. The public pages
 * are prerendered, so a changed service image went on showing the previous
 * photograph with nothing in the browser able to clear it. And a patch
 * carrying one field used to come back from validation with every other field
 * filled in with its default, which the database then stored, so changing an
 * image quietly emptied the body text, the icon and the ordering with it.
 *
 * The suite runs against a production build, so the caching here is the real
 * thing rather than the dev server's pass-through.
 *
 * Both tests put back exactly what they found, and send the whole record when
 * they do, so a restore cannot depend on the very behaviour under test.
 */

/**
 * Whether the page actually displays that image.
 *
 * This looks for the optimiser request the browser would make, not for the
 * asset id anywhere in the document. The two are different: a page serialises
 * far more data than it draws, so the site settings travel with every page and
 * carry the hero slide images with them. One of those slides uses the same
 * photograph as a service, which made a plain search for the id report an
 * image as still on display when nothing was drawing it.
 */
function displaysMedia(html: string, url: string): boolean {
  const id = url.match(/[0-9a-f-]{36}/i)?.[0];
  if (!id) throw new Error(`Not a media URL: ${url}`);
  return new RegExp(`%2Fapi%2Fmedia%2F${id}%2Fraw`, 'i').test(html);
}

/** The fields a write must not touch unless it was asked to. */
function withoutVolatile(record: Record<string, unknown>): Record<string, unknown> {
  const { updatedAt: _updated, createdAt: _created, ...rest } = record;
  return rest;
}

test.describe('an edit reaches the public site at once', () => {
  test.use({ storageState: ADMIN_STATE });

  test('a changed service hero replaces the old photograph on the next visit', async ({
    request,
  }) => {
    const listed = await request.get('/api/admin/services?pageSize=100');
    expect(listed.ok(), 'the admin can list services').toBeTruthy();

    const allServices = (await listed.json()).data.items;
    const service = allServices.find(
      (item: { isActive: boolean; heroImageUrl: string }) =>
        item.isActive && item.heroImageUrl?.startsWith('/api/media/'),
    );
    test.skip(!service, 'no active service uses a media library image');

    // An image nothing else on the site uses, so "the new image is on the
    // page" can only be true because this service put it there. Picking any
    // spare image would have let the assertion pass on another service's card.
    const spoken = new Set<string>();
    const noteUrl = (url?: string | null) => {
      const id = url?.match(/[0-9a-f-]{36}/i)?.[0];
      if (id) spoken.add(id.toLowerCase());
    };

    for (const item of allServices) {
      if (item.id !== service.id) noteUrl(item.heroImageUrl);
      for (const url of item.galleryUrls ?? []) noteUrl(url);
    }
    const projects = await request.get('/api/admin/projects?pageSize=100');
    expect(projects.ok()).toBeTruthy();
    for (const project of (await projects.json()).data.items) {
      noteUrl(project.coverImageUrl);
      for (const url of project.galleryUrls ?? []) noteUrl(url);
    }
    const settingsNow = await request.get('/api/admin/settings');
    expect(settingsNow.ok()).toBeTruthy();
    const settingsRow = (await settingsNow.json()).data;
    for (const slide of settingsRow.heroSlides ?? []) noteUrl(slide.imageUrl);
    noteUrl(settingsRow.logoUrl);
    noteUrl(settingsRow.ogImageUrl);

    const media = await request.get('/api/admin/media?pageSize=100');
    expect(media.ok(), 'the admin can list media').toBeTruthy();
    const replacement = ((await media.json()).data.items as { id: string; url: string }[]).find(
      (asset) =>
        asset.url.startsWith('/api/media/') &&
        asset.url !== service.heroImageUrl &&
        !spoken.has(asset.id.toLowerCase()),
    );
    test.skip(!replacement, 'every library image is already in use somewhere');

    const original: string = service.heroImageUrl;
    const detail = `/services/${service.slug}`;

    // Prime the pages, so this is tested against a warm cache rather than a
    // first render that would have been fresh anyway.
    for (const path of [detail, '/services']) {
      const primed = await request.get(path);
      expect(primed.ok()).toBeTruthy();
      expect(displaysMedia(await primed.text(), original)).toBe(true);
    }

    try {
      const saved = await request.patch(`/api/admin/services/${service.id}`, {
        data: { heroImageUrl: replacement!.url },
      });
      expect(saved.ok(), 'the service saves').toBeTruthy();

      // No waiting and no reload loop: the very next request must be fresh.
      for (const path of [detail, '/services']) {
        const html = await (await request.get(path)).text();
        expect(displaysMedia(html, replacement!.url), `${path} shows the new image`).toBe(true);
        expect(displaysMedia(html, original), `${path} dropped the old image`).toBe(false);
      }

      // Nothing but the image was sent, so nothing but the image may differ.
      // This is the guard on the data loss: the body text, the icon, the sort
      // order and the featured flag all have defaults that a careless patch
      // would write over.
      const after = (await (await request.get(`/api/admin/services/${service.id}`)).json()).data;
      expect(withoutVolatile(after)).toEqual(
        withoutVolatile({ ...service, heroImageUrl: replacement!.url }),
      );
    } finally {
      // The whole record, so putting it back cannot rely on partial updates
      // behaving correctly. Runs whatever happened above.
      const restored = await request.patch(`/api/admin/services/${service.id}`, {
        data: { ...service, heroImageUrl: original },
      });
      expect(restored.ok(), 'the service is restored').toBeTruthy();
    }

    const reverted = await (await request.get(detail)).text();
    expect(displaysMedia(reverted, original), 'the restore is visible too').toBe(true);

    const row = (await (await request.get(`/api/admin/services/${service.id}`)).json()).data;
    expect(withoutVolatile(row), 'the service is exactly as it was found').toEqual(
      withoutVolatile(service),
    );
  });

  test('a changed site setting reaches every page that reads it', async ({ request }) => {
    const current = await request.get('/api/admin/settings');
    expect(current.ok()).toBeTruthy();
    const settings = (await current.json()).data;

    const original: string = settings.tagline ?? '';
    const edited = `Revalidation probe ${Date.now()}`;

    // The tagline is read by the footer in the shared layout, so this exercises
    // the whole-site flush rather than one route.
    const primed = await request.get('/');
    expect(primed.ok()).toBeTruthy();
    expect(await primed.text()).not.toContain(edited);

    try {
      const saved = await request.patch('/api/admin/settings', { data: { tagline: edited } });
      expect(saved.ok(), 'the settings save').toBeTruthy();

      expect(await (await request.get('/')).text(), 'the home page shows it').toContain(edited);

      // One field was sent. Everything the site is built from must survive it:
      // these are the exact fields a defaulting patch once emptied.
      const after = (await (await request.get('/api/admin/settings')).json()).data;
      expect(withoutVolatile(after)).toEqual(withoutVolatile({ ...settings, tagline: edited }));
      expect(after.heroSlides, 'the hero slides survive').toEqual(settings.heroSlides);
      expect(after.stats, 'the statistics survive').toEqual(settings.stats);
      expect(after.businessHours, 'the opening hours survive').toEqual(settings.businessHours);
      expect(after.offices, 'the offices survive').toEqual(settings.offices);
      expect(after.emergencyBannerEnabled, 'the emergency banner stays as it was').toBe(
        settings.emergencyBannerEnabled,
      );
    } finally {
      const restored = await request.patch('/api/admin/settings', {
        data: { ...settings, tagline: original },
      });
      expect(restored.ok(), 'the settings are restored').toBeTruthy();
    }

    expect(await (await request.get('/')).text()).not.toContain(edited);

    const row = (await (await request.get('/api/admin/settings')).json()).data;
    expect(withoutVolatile(row), 'the settings are exactly as they were found').toEqual(
      withoutVolatile(settings),
    );

    // The page the office actually looks at, rather than only the API.
    const home = await request.get('/');
    const html = await home.text();
    expect(html, 'the hero headline is still on the page').toContain(
      settings.heroSlides?.[0]?.headline ?? '',
    );
  });
});
