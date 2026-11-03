import { z } from 'zod';
import { NotFoundError } from '@core/errors';
import { repositories, staffCardDeps } from '@infra/deps';
import { updateCardProfile } from '@app-layer/use-cases/staff-cards';
import { env } from '@infra/config/env';
import { ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { uuidSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

const cardSchema = z.object({
  jobTitle: z.string().trim().max(120).nullish(),
  phone: z.string().trim().max(32).nullish(),
  whatsapp: z.string().trim().max(32).nullish(),
  bio: z.string().trim().max(600).nullish(),
  location: z.string().trim().max(160).nullish(),
  linkedinUrl: z.string().trim().max(500).nullish(),
  specialities: z.array(z.string().trim().min(1).max(60)).max(8).optional(),
  avatarUrl: z.string().trim().max(1000).nullish(),
  cardPublished: z.boolean().optional(),
  cardSlug: z.string().trim().max(64).nullish(),
});

export const GET = route(async (_request: Request, context: Context) => {
  await requirePrincipal('viewer');
  const id = uuidSchema.parse((await context.params).id);

  const user = await repositories().users.findById(id);
  if (!user) throw new NotFoundError('User', id);

  return ok({
    user,
    cardUrl: user.cardSlug ? `${env.siteUrl}/card/${user.cardSlug}` : null,
  });
});

export const PATCH = route(async (request: Request, context: Context) => {
  const actor = await requirePrincipal('viewer');
  const id = uuidSchema.parse((await context.params).id);
  const input = cardSchema.parse(await request.json());

  // The use case enforces that only an admin may edit somebody else's card.
  const user = await updateCardProfile(staffCardDeps(), actor, id, input);

  return ok({
    user,
    cardUrl: user.cardSlug ? `${env.siteUrl}/card/${user.cardSlug}` : null,
  });
});
