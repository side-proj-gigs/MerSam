import { NextResponse } from 'next/server';
import { contentDeps, staffCardDeps } from '@infra/deps';
import { getSiteSettings } from '@app-layer/use-cases/content';
import { buildVCard, getPublishedCard } from '@app-layer/use-cases/staff-cards';
import { env } from '@infra/config/env';
import { route } from '@/presentation/http/respond';

export const runtime = 'nodejs';

/** Downloading this adds the person straight into the viewer's contacts. */
export const GET = route(async (_request: Request, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params;

  const [{ card }, settings] = await Promise.all([
    getPublishedCard(staffCardDeps(), slug),
    getSiteSettings(contentDeps()),
  ]);

  const vcard = buildVCard(card, {
    name: settings.companyName,
    url: env.siteUrl,
    address: [...settings.addressLines, settings.city, settings.country].filter(Boolean).join(', '),
  });

  const filename = `${card.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.vcf`;

  return new NextResponse(vcard, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=600',
    },
  });
});
