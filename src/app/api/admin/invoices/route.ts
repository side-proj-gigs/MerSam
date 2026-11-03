import { invoiceDeps, repositories } from '@infra/deps';
import { createInvoice } from '@app-layer/use-cases/invoices';
import { ok, route } from '@/presentation/http/respond';
import { withIdempotency } from '@/presentation/http/idempotency';
import { requirePrincipal } from '@/presentation/http/session';
import { invoiceFilterSchema, invoiceSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  await requirePrincipal('viewer');
  const filters = invoiceFilterSchema.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  return ok(await repositories().invoices.list(filters));
});

/**
 * Creating an invoice allocates a number from the shared sequence, so a
 * retried request must not burn a second one. The idempotency wrapper replays
 * the first response instead.
 */
export const POST = route(async (request: Request) => {
  const actor = await requirePrincipal('staff');
  const input = invoiceSchema.parse(await request.json());

  return withIdempotency(request, 'invoice.create', async () => ({
    status: 201,
    body: await createInvoice(invoiceDeps(), actor, {
      ...input,
      email: undefined,
      customerEmail: input.customerEmail || null,
    } as never),
  }));
});
