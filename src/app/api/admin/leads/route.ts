import { repositories } from '@infra/deps';
import { ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { leadFilterSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  await requirePrincipal('viewer');
  const url = new URL(request.url);
  const filters = leadFilterSchema.parse(Object.fromEntries(url.searchParams));
  return ok(await repositories().leads.list(filters));
});
