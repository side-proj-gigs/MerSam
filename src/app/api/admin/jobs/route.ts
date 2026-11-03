import { NotFoundError } from '@core/errors';
import { repositories } from '@infra/deps';
import { ok, route } from '@/presentation/http/respond';
import { withIdempotency } from '@/presentation/http/idempotency';
import { requirePrincipal } from '@/presentation/http/session';
import { jobSchema, parseListQuery } from '@/presentation/validation/schemas';
import { JOB_STATUSES, type JobStatus } from '@core/entities';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  await requirePrincipal('viewer');
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  return ok(
    await repositories().jobs.list({
      ...parseListQuery(url),
      status: JOB_STATUSES.includes(status as JobStatus) ? (status as JobStatus) : undefined,
      clientId: url.searchParams.get('clientId') ?? undefined,
    }),
  );
});

export const POST = route(async (request: Request) => {
  const actor = await requirePrincipal('staff');
  const input = jobSchema.parse(await request.json());

  return withIdempotency(request, 'job.create', async () => {
    const repos = repositories();
    const client = await repos.clients.findById(input.clientId);
    if (!client) throw new NotFoundError('Client', input.clientId);

    const year = new Date().getFullYear();
    const sequence = await repos.jobs.nextSequence(year);

    const job = await repos.jobs.create({
      id: crypto.randomUUID(),
      reference: `JOB-${year}-${String(sequence).padStart(4, '0')}`,
      ...input,
      siteAddress: input.siteAddress || client.address,
      serviceId: input.serviceId ?? null,
      leadId: input.leadId ?? null,
      assignedTo: input.assignedTo ?? null,
      scheduledFor: input.scheduledFor ?? null,
      startedOn: input.startedOn ?? null,
      completedOn: input.completedOn ?? null,
      internalNotes: input.internalNotes ?? null,
    });

    await repos.audit.record({
      actorId: actor.userId,
      action: 'create',
      entity: 'job',
      entityId: job.id,
      summary: `${actor.name} scheduled ${job.reference} for ${client.name}`,
    });

    return { status: 201, body: job };
  });
});
