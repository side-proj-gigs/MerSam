import { contentDeps, emailDeps, invoiceDeps, repositories } from '@infra/deps';
import { sendInvoiceEmail } from '@app-layer/use-cases/email';
import { sendInvoice } from '@app-layer/use-cases/invoices';
import { getSiteSettings } from '@app-layer/use-cases/content';
import { brandingFrom, invoiceEmail } from '@infra/email/templates';
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

  const invoice = await repositories().invoices.findById(id);
  if (!invoice) throw new NotFoundError('Invoice', id);

  const outcome = await sendInvoiceEmail(
    emailDeps(),
    actor,
    id,
    { to: input.to || undefined, note: input.note },
    (settings, note) => invoiceEmail(invoice, brandingFrom(settings, env.siteUrl), note),
  );

  // Emailing a draft is how it gets issued.
  const updated =
    outcome.status === 'sent' && invoice.status === 'draft'
      ? await sendInvoice(invoiceDeps(), actor, id)
      : invoice;

  return ok({ outcome, invoice: updated });
});
