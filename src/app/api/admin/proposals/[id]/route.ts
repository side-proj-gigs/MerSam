import { NotFoundError } from '@core/errors';
import { proposalDeps, repositories } from '@infra/deps';
import { deleteProposal, updateProposal } from '@app-layer/use-cases/proposals';
import { noContent, ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { uuidSchema } from '@/presentation/validation/schemas';
import { proposalUpdateSchema } from '@/presentation/validation/proposal-schemas';
import { parsePatch } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, context: Context) => {
  await requirePrincipal('viewer');
  const id = uuidSchema.parse((await context.params).id);
  const repos = repositories();

  const proposal = await repos.proposals.findById(id);
  if (!proposal) throw new NotFoundError('Proposal', id);

  // The admin shows when this last reached someone, so resending is informed.
  const lastEmail = await repos.emailLog.lastSuccessFor('proposal', id);
  return ok({ proposal, lastEmail });
});

export const PATCH = route(async (request: Request, context: Context) => {
  const actor = await requirePrincipal('staff');
  const id = uuidSchema.parse((await context.params).id);
  const input = parsePatch(proposalUpdateSchema, await request.json());
  return ok(await updateProposal(proposalDeps(), actor, id, input as never));
});

export const DELETE = route(async (_request: Request, context: Context) => {
  const actor = await requirePrincipal('admin');
  await deleteProposal(proposalDeps(), actor, uuidSchema.parse((await context.params).id));
  return noContent();
});
