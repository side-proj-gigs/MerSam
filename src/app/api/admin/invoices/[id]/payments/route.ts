import { invoiceDeps, repositories } from '@infra/deps';
import { recordPayment } from '@app-layer/use-cases/invoices';
import { ok, route } from '@/presentation/http/respond';
import { withIdempotency } from '@/presentation/http/idempotency';
import { requirePrincipal } from '@/presentation/http/session';
import { paymentSchema, uuidSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, context: Context) => {
  await requirePrincipal('viewer');
  const id = uuidSchema.parse((await context.params).id);
  return ok(await repositories().payments.listForInvoice(id));
});

/**
 * Recording money is the write that most needs protecting from a double
 * submission, so an Idempotency-Key is honoured here as well as on create.
 */
export const POST = route(async (request: Request, context: Context) => {
  const actor = await requirePrincipal('staff');
  const invoiceId = uuidSchema.parse((await context.params).id);
  const input = paymentSchema.parse(await request.json());

  return withIdempotency(request, 'payment.create', async () => ({
    status: 201,
    body: await recordPayment(invoiceDeps(), actor, { invoiceId, ...input }),
  }));
});
