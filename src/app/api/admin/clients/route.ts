import { repositories } from '@infra/deps';
import { PhoneNumber } from '@core/value-objects/contact';
import { ok, route } from '@/presentation/http/respond';
import { withIdempotency } from '@/presentation/http/idempotency';
import { requirePrincipal } from '@/presentation/http/session';
import { clientSchema, parseListQuery } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  await requirePrincipal('viewer');
  return ok(await repositories().clients.list(parseListQuery(new URL(request.url))));
});

export const POST = route(async (request: Request) => {
  const actor = await requirePrincipal('staff');
  const input = clientSchema.parse(await request.json());

  return withIdempotency(request, 'client.create', async () => {
    const repos = repositories();
    const phone = PhoneNumber.create(input.phone).e164;

    // A client already on this number is returned rather than duplicated.
    const existing = await repos.clients.findByPhone(phone);
    if (existing) return { status: 200, body: existing };

    const client = await repos.clients.create({
      id: crypto.randomUUID(),
      reference: `CL-${String(await repos.clients.nextSequence()).padStart(4, '0')}`,
      ...input,
      phone,
      email: input.email || null,
      contactPerson: input.contactPerson ?? null,
      altPhone: input.altPhone ?? null,
      notes: input.notes ?? null,
    });

    await repos.audit.record({
      actorId: actor.userId,
      action: 'create',
      entity: 'client',
      entityId: client.id,
      summary: `${actor.name} added client ${client.name}`,
    });

    return { status: 201, body: client };
  });
});
