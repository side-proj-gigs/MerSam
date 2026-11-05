import { proposalDeps, repositories } from '@infra/deps';
import { createProposal } from '@app-layer/use-cases/proposals';
import { ok, route } from '@/presentation/http/respond';
import { withIdempotency } from '@/presentation/http/idempotency';
import { requirePrincipal } from '@/presentation/http/session';
import { proposalFilterSchema, proposalSchema } from '@/presentation/validation/proposal-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  await requirePrincipal('viewer');
  const filters = proposalFilterSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await repositories().proposals.list(filters));
});

/**
 * Creating a proposal allocates a number from a shared sequence, so a retried
 * request must not burn a second one.
 */
export const POST = route(async (request: Request) => {
  const actor = await requirePrincipal('staff');
  const input = proposalSchema.parse(await request.json());

  return withIdempotency(request, 'proposal.create', async () => ({
    status: 201,
    body: await createProposal(proposalDeps(), actor, {
      ...input,
      clientEmail: input.clientEmail || null,
    } as never),
  }));
});
