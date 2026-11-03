import { cookies } from 'next/headers';
import { authDeps } from '@infra/deps';
import { login } from '@app-layer/use-cases/auth';
import { ok, route } from '@/presentation/http/respond';
import { clientFingerprint, sessionCookieOptions } from '@/presentation/http/session';
import { loginSchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (request: Request) => {
  const input = loginSchema.parse(await request.json());

  const result = await login(authDeps(), {
    ...input,
    fingerprint: await clientFingerprint(),
  });

  // HttpOnly so the token is never reachable from page scripts.
  (await cookies()).set({
    ...sessionCookieOptions(result.session.expiresAt),
    value: result.session.token,
  });

  return ok({ user: result.user });
});
