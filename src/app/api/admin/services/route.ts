import { contentDeps, repositories } from '@infra/deps';
import { createService } from '@app-layer/use-cases/content';
import { revalidatePublicSite } from '@/presentation/http/revalidate';
import { created, ok, route } from '@/presentation/http/respond';
import { withIdempotency } from '@/presentation/http/idempotency';
import { requirePrincipal } from '@/presentation/http/session';
import { parseListQuery, serviceSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  await requirePrincipal('viewer');
  const url = new URL(request.url);
  return ok(
    await repositories().services.list({
      ...parseListQuery(url),
      includeInactive: true,
      categoryId: url.searchParams.get('categoryId') ?? undefined,
      featuredOnly: url.searchParams.get('featured') === 'true' || undefined,
    }),
  );
});

export const POST = route(async (request: Request) => {
  const actor = await requirePrincipal('admin');
  const input = serviceSchema.parse(await request.json());
  return withIdempotency(request, 'service.create', async () => {
    const service = await createService(contentDeps(), actor, input as never);
    // The new service belongs on the services page now, not in five minutes.
    revalidatePublicSite();
    return { status: 201, body: service };
  });
});
