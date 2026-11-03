import { leadDeps } from '@infra/deps';
import { submitEnquiry } from '@app-layer/use-cases/leads';
import { route } from '@/presentation/http/respond';
import { withIdempotency } from '@/presentation/http/idempotency';
import { clientFingerprint } from '@/presentation/http/session';
import { enquirySchema } from '@/presentation/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The public quote request. Three guards already sit inside the use case: the
 * honeypot, a per-client rate limit and a content hash that collapses a
 * double submission. The idempotency wrapper adds a fourth for clients that
 * send a key, which is what the form on this site does.
 */
export const POST = route(async (request: Request) => {
  const body = await request.json();
  const input = enquirySchema.parse(body);

  return withIdempotency(request, 'enquiry.create', async () => {
    const lead = await submitEnquiry(leadDeps(), {
      fullName: input.fullName,
      email: input.email || null,
      phone: input.phone,
      location: input.location,
      serviceId: input.serviceId ?? null,
      message: input.message,
      urgency: input.urgency,
      budgetHint: input.budgetHint ?? null,
      source: 'website',
      fingerprint: await clientFingerprint(),
      honeypot: input.website,
    });

    // Only the reference goes back, never the stored record.
    return { status: 201, body: { reference: lead.reference } };
  });
});
