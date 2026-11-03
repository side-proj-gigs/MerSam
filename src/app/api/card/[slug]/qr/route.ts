import { NextResponse } from 'next/server';
import { z } from 'zod';
import { staffCardDeps } from '@infra/deps';
import { getPublishedCard } from '@app-layer/use-cases/staff-cards';
import { qrSvgFor } from '@infra/qr/render';
import { env } from '@infra/config/env';
import { route } from '@/presentation/http/respond';

export const runtime = 'nodejs';
export const revalidate = 3600;

const querySchema = z.object({
  theme: z.enum(['light', 'dark', 'gold']).default('light'),
  size: z.coerce.number().int().min(128).max(2048).default(640),
  logo: z.enum(['on', 'off']).default('on'),
});

/** The plain scannable code, styled to match the rest of the product. */
export const GET = route(async (request: Request, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params;
  const { theme, size, logo } = querySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  // Resolving the card first means an unpublished slug cannot be probed.
  const { card } = await getPublishedCard(staffCardDeps(), slug);

  const svg = await qrSvgFor(`${env.siteUrl}/card/${card.slug}`, {
    theme,
    size,
    withLogoSlot: logo === 'on',
  });

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
});
