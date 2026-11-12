import { NotFoundError } from '@core/errors';
import { repositories, workReportDeps } from '@infra/deps';
import { deleteWorkReport, updateWorkReport } from '@app-layer/use-cases/work-reports';
import { noContent, ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { parsePatch, uuidSchema, workReportUpdateSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, context: Context) => {
  await requirePrincipal('viewer');
  const id = uuidSchema.parse((await context.params).id);
  const report = await repositories().workReports.findById(id);
  if (!report) throw new NotFoundError('Work report', id);
  return ok(report);
});

export const PATCH = route(async (request: Request, context: Context) => {
  const actor = await requirePrincipal('staff');
  const id = uuidSchema.parse((await context.params).id);
  const input = parsePatch(workReportUpdateSchema, await request.json());
  return ok(await updateWorkReport(workReportDeps(), actor, id, input as never));
});

export const DELETE = route(async (_request: Request, context: Context) => {
  const actor = await requirePrincipal('admin');
  await deleteWorkReport(workReportDeps(), actor, uuidSchema.parse((await context.params).id));
  return noContent();
});
