import { contentDeps } from '@infra/deps';
import { reorderServices } from '@app-layer/use-cases/content';
import { ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { reorderSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Drag and drop in the admin list sends the whole order in one request. */
export const POST = route(async (request: Request) => {
  const actor = await requirePrincipal('admin');
  const { order } = reorderSchema.parse(await request.json());
  await reorderServices(contentDeps(), actor, order);
  return ok({ reordered: order.length });
});
