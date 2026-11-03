import { NotFoundError } from '@core/errors';
import { leadDeps, repositories } from '@infra/deps';
import { assignLead, deleteLead, updateLeadStatus } from '@app-layer/use-cases/leads';
import { noContent, ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { updateLeadSchema, uuidSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, context: Context) => {
  await requirePrincipal('viewer');
  const id = uuidSchema.parse((await context.params).id);
  const lead = await repositories().leads.findById(id);
  if (!lead) throw new NotFoundError('Lead', id);
  return ok(lead);
});

export const PATCH = route(async (request: Request, context: Context) => {
  const actor = await requirePrincipal('staff');
  const id = uuidSchema.parse((await context.params).id);
  const input = updateLeadSchema.parse(await request.json());

  const deps = leadDeps();
  let lead = await repositories().leads.findById(id);
  if (!lead) throw new NotFoundError('Lead', id);

  if (input.assignedTo !== undefined) lead = await assignLead(deps, actor, id, input.assignedTo ?? null);
  if (input.status) lead = await updateLeadStatus(deps, actor, id, input.status, input.note);

  return ok(lead);
});

export const DELETE = route(async (_request: Request, context: Context) => {
  const actor = await requirePrincipal('admin');
  await deleteLead(leadDeps(), actor, uuidSchema.parse((await context.params).id));
  return noContent();
});
