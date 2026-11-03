import { NextResponse } from 'next/server';
import { z } from 'zod';
import { contentDeps, staffCardDeps } from '@infra/deps';
import { getSiteSettings } from '@app-layer/use-cases/content';
import { getPublishedCard } from '@app-layer/use-cases/staff-cards';
import { renderWallpaperSvg } from '@infra/qr/wallpaper';
import { env } from '@infra/config/env';
import { route } from '@/presentation/http/respond';

export const runtime = 'nodejs';
export const revalidate = 3600;

/**
 * The lower bounds allow the small preview the card page renders beside the
 * download button, not just full device resolutions.
 */
const querySchema = z.object({
  theme: z.enum(['light', 'dark', 'gold']).default('dark'),
  width: z.coerce.number().int().min(180).max(2400).default(1290),
  height: z.coerce.number().int().min(320).max(4000).default(2796),
});

/**
 * A phone wallpaper carrying the person's code. Served as SVG so it stays
 * crisp at any device resolution; the browser rasterises it when the viewer
 * saves it from the card page.
 */
export const GET = route(async (request: Request, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params;
  const { theme, width, height } = querySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  const [{ card }, settings] = await Promise.all([
    getPublishedCard(staffCardDeps(), slug),
    getSiteSettings(contentDeps()),
  ]);

  const svg = await renderWallpaperSvg({
    name: card.name,
    jobTitle: card.jobTitle,
    company: settings.companyName,
    phone: card.phone,
    url: `${env.siteUrl}/card/${card.slug}`,
    theme,
    width,
    height,
  });

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
});
