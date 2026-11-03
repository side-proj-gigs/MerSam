import { invoiceDeps } from '@infra/deps';
import { sendInvoice } from '@app-layer/use-cases/invoices';
import { ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { uuidSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Naturally idempotent: an invoice already sent is returned unchanged. */
export const POST = route(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const actor = await requirePrincipal('staff');
  const id = uuidSchema.parse((await context.params).id);
  return ok(await sendInvoice(invoiceDeps(), actor, id));
});
