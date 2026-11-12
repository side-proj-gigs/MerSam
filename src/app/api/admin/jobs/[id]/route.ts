import { NotFoundError } from '@core/errors';
import { repositories } from '@infra/deps';
import { noContent, ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { jobSchema, parsePatch, uuidSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, context: Context) => {
  await requirePrincipal('viewer');
  const id = uuidSchema.parse((await context.params).id);
  const job = await repositories().jobs.findById(id);
  if (!job) throw new NotFoundError('Job', id);
  return ok(job);
});

export const PATCH = route(async (request: Request, context: Context) => {
  const actor = await requirePrincipal('staff');
  const id = uuidSchema.parse((await context.params).id);
  const input = parsePatch(jobSchema, await request.json());

  const repos = repositories();
  // Marking a job complete stamps the completion date if one was not supplied.
  const patch =
    input.status === 'completed' && input.completedOn === undefined
      ? { ...input, completedOn: new Date() }
      : input;

  const job = await repos.jobs.update(id, patch);
  await repos.audit.record({
    actorId: actor.userId,
    action: 'update',
    entity: 'job',
    entityId: id,
    summary: `${actor.name} updated ${job.reference}`,
  });
  return ok(job);
});

export const DELETE = route(async (_request: Request, context: Context) => {
  const actor = await requirePrincipal('admin');
  const id = uuidSchema.parse((await context.params).id);
  const repos = repositories();

  const job = await repos.jobs.findById(id);
  if (!job) throw new NotFoundError('Job', id);

  await repos.jobs.delete(id);
  await repos.audit.record({
    actorId: actor.userId,
    action: 'delete',
    entity: 'job',
    entityId: id,
    summary: `${actor.name} deleted ${job.reference}`,
  });
  return noContent();
});
