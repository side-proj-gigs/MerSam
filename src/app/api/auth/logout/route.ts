import { cookies } from 'next/headers';
import { ok, route } from '@/presentation/http/respond';
import { SESSION_COOKIE } from '@/presentation/http/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async () => {
  (await cookies()).delete(SESSION_COOKIE);
  return ok({ signedOut: true });
});
