import { emailDeps, proposalDeps, repositories } from '@infra/deps';
import { sendProposalEmail } from '@app-layer/use-cases/email';
import { markProposalSent } from '@app-layer/use-cases/proposals';
import { brandingFrom, proposalEmail } from '@infra/email/templates';
import { env } from '@infra/config/env';
import { NotFoundError } from '@core/errors';
import { ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { uuidSchema } from '@/presentation/validation/schemas';
import { sendDocumentSchema } from '@/presentation/validation/proposal-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = route(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const actor = await requirePrincipal('staff');
  const id = uuidSchema.parse((await context.params).id);
  const input = sendDocumentSchema.parse(await request.json().catch(() => ({})));

  const proposal = await repositories().proposals.findById(id);
  if (!proposal) throw new NotFoundError('Proposal', id);

  const outcome = await sendProposalEmail(
    emailDeps(),
    actor,
    id,
    { to: input.to || undefined, note: input.note },
    (settings, note) => proposalEmail(proposal, brandingFrom(settings, env.siteUrl), note),
  );

  // Sending is what issues a proposal, so the status follows a success.
  const updated =
    outcome.status === 'sent'
      ? await markProposalSent(proposalDeps(), actor, id)
      : proposal;

  return ok({ outcome, proposal: updated });
});
