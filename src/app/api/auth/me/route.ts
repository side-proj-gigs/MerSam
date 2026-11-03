import { ok, route } from '@/presentation/http/respond';
import { currentPrincipal } from '@/presentation/http/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Returns null rather than 401 so the client can treat it as a plain check. */
export const GET = route(async () => ok({ user: await currentPrincipal() }));
