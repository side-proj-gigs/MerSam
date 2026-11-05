import { proposalDeps } from '@infra/deps';
import { draftProposalFromLead } from '@app-layer/use-cases/proposals';
import { route } from '@/presentation/http/respond';
import { withIdempotency } from '@/presentation/http/idempotency';
import { requirePrincipal } from '@/presentation/http/session';
import { proposalFromLeadSchema } from '@/presentation/validation/proposal-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Starts a proposal from an enquiry, carrying across what the person asked for. */
export const POST = route(async (request: Request) => {
  const actor = await requirePrincipal('staff');
  const { leadId, ...overrides } = proposalFromLeadSchema.parse(await request.json());

  return withIdempotency(request, 'proposal.from_lead', async () => ({
    status: 201,
    body: await draftProposalFromLead(proposalDeps(), actor, leadId, overrides as never),
  }));
});
