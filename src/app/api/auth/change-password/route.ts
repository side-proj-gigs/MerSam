import { authDeps } from '@infra/deps';
import { changePassword } from '@app-layer/use-cases/auth';
import { ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { changePasswordSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (request: Request) => {
  const actor = await requirePrincipal('viewer');
  const input = changePasswordSchema.parse(await request.json());
  await changePassword(authDeps(), actor, input);
  return ok({ changed: true });
});
