import type { Notifier } from '@app-layer/ports';
import { sendEnquiryConfirmation, sendLeadNotification } from '@app-layer/use-cases/email';
import { env } from '../config/env';

/**
 * What happens after a visitor submits the contact form.
 *
 * Two messages go out: a confirmation to the person, so they have a reference
 * and know they were heard, and an alert to the office so nobody has to watch
 * the dashboard. Both are best effort. The enquiry itself is already saved by
 * the time this runs, and a mail provider having a bad day must never turn a
 * successful submission into an error on the visitor's screen.
 */
export function createEmailNotifier(): Notifier {
  return {
    async notifyNewLead(lead) {
      // Imported lazily: this module is reached from the container, which is
      // loaded on every request, and the templates pull in the whole brand.
      const [{ emailDeps }, templates] = await Promise.all([
        import('../deps'),
        import('./templates'),
      ]);

      const deps = emailDeps();
      const branding = templates.brandingFrom(await deps.settings.get(), env.siteUrl);

      const results = await Promise.allSettled([
        sendEnquiryConfirmation(deps, lead, () =>
          templates.enquiryConfirmationEmail(lead, branding),
        ),
        sendLeadNotification(deps, lead, () => templates.leadNotificationEmail(lead, branding)),
      ]);

      for (const result of results) {
        if (result.status === 'rejected') {
          console.error('[email] enquiry notification failed', result.reason);
        }
      }

      const confirmation = results[0];
      console.info(
        `[lead] ${lead.reference} from ${lead.fullName} (${lead.phone}), confirmation ${
          confirmation.status === 'fulfilled' ? confirmation.value.status : 'errored'
        }`,
      );
    },
  };
}
