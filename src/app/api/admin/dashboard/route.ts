import { dashboardDeps } from '@infra/deps';
import { getDashboardMetrics } from '@app-layer/use-cases/dashboard';
import { ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const actor = await requirePrincipal('staff');
  return ok(await getDashboardMetrics(dashboardDeps(), actor));
});
