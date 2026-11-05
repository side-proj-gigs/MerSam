import { proposalDeps } from '@infra/deps';
import { markProposalSent, recordProposalDecision } from '@app-layer/use-cases/proposals';
import { ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { uuidSchema } from '@/presentation/validation/schemas';
import { proposalDecisionSchema } from '@/presentation/validation/proposal-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Records the client's answer. Accepting also closes the originating enquiry. */
export const POST = route(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const actor = await requirePrincipal('staff');
  const id = uuidSchema.parse((await context.params).id);
  const { decision, note } = proposalDecisionSchema.parse(await request.json());
  return ok(await recordProposalDecision(proposalDeps(), actor, id, decision, note));
});

/** Marks a draft as issued without sending anything. */
export const PUT = route(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const actor = await requirePrincipal('staff');
  const id = uuidSchema.parse((await context.params).id);
  return ok(await markProposalSent(proposalDeps(), actor, id));
});
