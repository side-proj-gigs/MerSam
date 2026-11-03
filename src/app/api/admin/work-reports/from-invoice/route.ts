import { z } from 'zod';
import { workReportDeps } from '@infra/deps';
import { draftReportFromInvoice } from '@app-layer/use-cases/work-reports';
import { route } from '@/presentation/http/respond';
import { withIdempotency } from '@/presentation/http/idempotency';
import { requirePrincipal } from '@/presentation/http/session';
import { dateSchema, uuidSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  invoiceId: uuidSchema,
  serviceCategory: z.string().trim().max(160).optional(),
  workPerformed: z.string().trim().max(8000).optional(),
  dateOfWork: dateSchema.optional(),
});

/** Builds a draft report carrying the invoice's own figures. */
export const POST = route(async (request: Request) => {
  const actor = await requirePrincipal('staff');
  const { invoiceId, ...overrides } = bodySchema.parse(await request.json());

  return withIdempotency(request, 'work_report.from_invoice', async () => ({
    status: 201,
    body: await draftReportFromInvoice(workReportDeps(), actor, invoiceId, overrides),
  }));
});
