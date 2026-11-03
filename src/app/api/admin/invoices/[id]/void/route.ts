import { z } from 'zod';
import { invoiceDeps } from '@infra/deps';
import { voidInvoice } from '@app-layer/use-cases/invoices';
import { ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { uuidSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ reason: z.string().trim().max(500).default('') });

export const POST = route(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const actor = await requirePrincipal('admin');
  const id = uuidSchema.parse((await context.params).id);
  const { reason } = bodySchema.parse(await request.json().catch(() => ({})));
  return ok(await voidInvoice(invoiceDeps(), actor, id, reason));
});
