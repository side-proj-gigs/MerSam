import { workReportDeps } from '@infra/deps';
import { issueWorkReport } from '@app-layer/use-cases/work-reports';
import { ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { uuidSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const actor = await requirePrincipal('staff');
  const id = uuidSchema.parse((await context.params).id);
  return ok(await issueWorkReport(workReportDeps(), actor, id));
});
