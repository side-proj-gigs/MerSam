import { NotFoundError } from '@core/errors';
import { invoiceDeps, repositories } from '@infra/deps';
import { deleteInvoice, updateInvoice } from '@app-layer/use-cases/invoices';
import { noContent, ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { invoiceUpdateSchema, uuidSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, context: Context) => {
  await requirePrincipal('viewer');
  const id = uuidSchema.parse((await context.params).id);
  const repos = repositories();

  const invoice = await repos.invoices.findById(id);
  if (!invoice) throw new NotFoundError('Invoice', id);

  const payments = await repos.payments.listForInvoice(id);
  return ok({ invoice, payments });
});

export const PATCH = route(async (request: Request, context: Context) => {
  const actor = await requirePrincipal('staff');
  const id = uuidSchema.parse((await context.params).id);
  const input = invoiceUpdateSchema.parse(await request.json());
  return ok(await updateInvoice(invoiceDeps(), actor, id, input as never));
});

export const DELETE = route(async (_request: Request, context: Context) => {
  const actor = await requirePrincipal('admin');
  await deleteInvoice(invoiceDeps(), actor, uuidSchema.parse((await context.params).id));
  return noContent();
});
