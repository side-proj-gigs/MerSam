import { leadDeps } from '@infra/deps';
import { convertLeadToClient } from '@app-layer/use-cases/leads';
import { route } from '@/presentation/http/respond';
import { withIdempotency } from '@/presentation/http/idempotency';
import { requirePrincipal } from '@/presentation/http/session';
import { uuidSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Idempotent: converting twice returns the same client rather than two. */
export const POST = route(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const actor = await requirePrincipal('staff');
  const id = uuidSchema.parse((await context.params).id);
  return withIdempotency(request, 'lead.convert', async () => ({
    status: 200,
    body: await convertLeadToClient(leadDeps(), actor, id),
  }));
});
