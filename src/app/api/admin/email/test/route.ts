import { contentDeps, emailDeps } from '@infra/deps';
import { sendTestEmail } from '@app-layer/use-cases/email';
import { getSiteSettings } from '@app-layer/use-cases/content';
import { brandingFrom, testEmail } from '@infra/email/templates';
import { env } from '@infra/config/env';
import { ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';
import { testEmailSchema } from '@/presentation/validation/proposal-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proves the configuration end to end before anyone relies on it. */
export const POST = route(async (request: Request) => {
  const actor = await requirePrincipal('admin');
  const { to } = testEmailSchema.parse(await request.json());
  const settings = await getSiteSettings(contentDeps());

  const outcome = await sendTestEmail(emailDeps(), actor, to, () =>
    testEmail(brandingFrom(settings, env.siteUrl)),
  );

  return ok(outcome);
});
