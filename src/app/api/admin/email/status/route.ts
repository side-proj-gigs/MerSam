import { contentDeps, emailDeps } from '@infra/deps';
import { activeEmailProvider } from '@infra/email/sender';
import { getEmailStatus } from '@app-layer/use-cases/email';
import { getSiteSettings } from '@app-layer/use-cases/content';
import { ok, route } from '@/presentation/http/respond';
import { requirePrincipal } from '@/presentation/http/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Tells the admin whether email will actually send, and why not if it will not. */
export const GET = route(async () => {
  const actor = await requirePrincipal('viewer');
  const [status, settings] = await Promise.all([
    getEmailStatus(emailDeps(), actor),
    getSiteSettings(contentDeps()),
  ]);

  return ok({
    ...status,
    // Which of the two providers is in play, so the settings page can say so
    // rather than always naming Resend.
    provider: activeEmailProvider(),
    confirmationsEnabled: settings.sendEnquiryConfirmation,
    bcc: settings.emailBcc,
  });
});
