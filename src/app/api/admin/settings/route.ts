import { contentDeps } from '@infra/deps';
import { getSiteSettings, updateSiteSettings } from '@app-layer/use-cases/content';
import { revalidatePublicSite } from '@/presentation/http/revalidate';
import { ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { parsePatch, settingsSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requirePrincipal('viewer');
  return ok(await getSiteSettings(contentDeps()));
});

export const PATCH = route(async (request: Request) => {
  const actor = await requirePrincipal('admin');
  const input = parsePatch(settingsSchema, await request.json());
  const settings = await updateSiteSettings(contentDeps(), actor, input as never);
  // Read by the layout, so this touches every page rather than one of them.
  revalidatePublicSite();
  return ok(settings);
});
