import { emailDeps, repositories } from '@infra/deps';
import { sendWorkReportEmail } from '@app-layer/use-cases/email';
import { brandingFrom, workReportEmail } from '@infra/email/templates';
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

  const report = await repositories().workReports.findById(id);
  if (!report) throw new NotFoundError('Work report', id);

  const outcome = await sendWorkReportEmail(
    emailDeps(),
    actor,
    id,
    { to: input.to || undefined, note: input.note },
    (settings, note) => workReportEmail(report, brandingFrom(settings, env.siteUrl), note),
  );

  return ok({ outcome });
});
