import { NotFoundError } from '@core/errors';
import { repositories } from '@infra/deps';
import { noContent, ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { clientSchema, parsePatch, uuidSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, context: Context) => {
  await requirePrincipal('viewer');
  const id = uuidSchema.parse((await context.params).id);
  const repos = repositories();

  const client = await repos.clients.findById(id);
  if (!client) throw new NotFoundError('Client', id);

  // The detail panel shows the client alongside their jobs and invoices.
  const [jobs, invoices] = await Promise.all([
    repos.jobs.list({ clientId: id, pageSize: 50 }),
    repos.invoices.list({ clientId: id, pageSize: 50 }),
  ]);

  return ok({ client, jobs: jobs.items, invoices: invoices.items });
});

export const PATCH = route(async (request: Request, context: Context) => {
  const actor = await requirePrincipal('staff');
  const id = uuidSchema.parse((await context.params).id);
  const input = parsePatch(clientSchema, await request.json());

  const repos = repositories();
  const client = await repos.clients.update(id, { ...input, email: input.email || null });
  await repos.audit.record({
    actorId: actor.userId,
    action: 'update',
    entity: 'client',
    entityId: id,
    summary: `${actor.name} updated client ${client.name}`,
  });
  return ok(client);
});

export const DELETE = route(async (_request: Request, context: Context) => {
  const actor = await requirePrincipal('admin');
  const id = uuidSchema.parse((await context.params).id);
  const repos = repositories();

  const client = await repos.clients.findById(id);
  if (!client) throw new NotFoundError('Client', id);

  await repos.clients.delete(id);
  await repos.audit.record({
    actorId: actor.userId,
    action: 'delete',
    entity: 'client',
    entityId: id,
    summary: `${actor.name} removed client ${client.name}`,
  });
  return noContent();
});
