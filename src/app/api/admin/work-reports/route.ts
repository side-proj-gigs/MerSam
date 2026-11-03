import { repositories, workReportDeps } from '@infra/deps';
import { createWorkReport } from '@app-layer/use-cases/work-reports';
import { ok, route } from '@/presentation/http/respond';
import { withIdempotency } from '@/presentation/http/idempotency';
import { requirePrincipal } from '@/presentation/http/session';
import { parseListQuery, workReportSchema } from '@/presentation/validation/schemas';
import { WORK_REPORT_STATUSES, type WorkReportStatus } from '@core/entities';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  await requirePrincipal('viewer');
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  return ok(
    await repositories().workReports.list({
      ...parseListQuery(url),
      status: WORK_REPORT_STATUSES.includes(status as WorkReportStatus)
        ? (status as WorkReportStatus)
        : undefined,
      clientId: url.searchParams.get('clientId') ?? undefined,
    }),
  );
});

export const POST = route(async (request: Request) => {
  const actor = await requirePrincipal('staff');
  const input = workReportSchema.parse(await request.json());
  return withIdempotency(request, 'work_report.create', async () => ({
    status: 201,
    body: await createWorkReport(workReportDeps(), actor, input as never),
  }));
});
