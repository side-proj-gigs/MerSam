import { contentDeps } from '@infra/deps';
import { getSiteSettings, updateSiteSettings } from '@app-layer/use-cases/content';
import { ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { settingsSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requirePrincipal('viewer');
  return ok(await getSiteSettings(contentDeps()));
});

export const PATCH = route(async (request: Request) => {
  const actor = await requirePrincipal('admin');
  const input = settingsSchema.parse(await request.json());
  return ok(await updateSiteSettings(contentDeps(), actor, input as never));
});
