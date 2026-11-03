import { authDeps, repositories } from '@infra/deps';
import { createUser } from '@app-layer/use-cases/auth';
import { created, ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { createUserSchema, parseListQuery } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  await requirePrincipal('admin');
  return ok(await repositories().users.list(parseListQuery(new URL(request.url))));
});

export const POST = route(async (request: Request) => {
  const actor = await requirePrincipal('admin');
  const input = createUserSchema.parse(await request.json());
  return created(await createUser(authDeps(), actor, input));
});
