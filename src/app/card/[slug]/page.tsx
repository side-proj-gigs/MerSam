import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { isAppError } from '@core/errors';
import { contentDeps, repositories, staffCardDeps } from '@infra/deps';
import { getSiteSettings } from '@app-layer/use-cases/content';
import { getPublishedCard } from '@app-layer/use-cases/staff-cards';
import { env } from '@infra/config/env';
import { DigitalCard } from '@/components/card/digital-card';

// A card changes rarely, so it is cached and refreshed in the background.
export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const [{ card }, settings] = await Promise.all([
      getPublishedCard(staffCardDeps(), slug),
      getSiteSettings(contentDeps()),
    ]);

    const title = `${card.name}, ${card.jobTitle}`;
    const description = `${card.name} at ${settings.companyName}. ${card.bio ?? settings.tagline}`;

    return {
      title,
      description,
      // A personal card has no business being indexed.
      robots: { index: false, follow: false },
      openGraph: {
        title,
        description,
        type: 'profile',
        url: `${env.siteUrl}/card/${card.slug}`,
      },
    };
  } catch {
    return { title: 'Card not found', robots: { index: false, follow: false } };
  }
}

export default async function DigitalCardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const result = await getPublishedCard(staffCardDeps(), slug).catch((error) => {
    if (isAppError(error) && error.code === 'NOT_FOUND') notFound();
    throw error;
  });

  const settings = await getSiteSettings(contentDeps());

  // Counted without blocking the render, and never allowed to fail the page.
  void repositories().users.recordCardView(result.user.id);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: result.card.name,
    jobTitle: result.card.jobTitle,
    email: result.card.email,
    telephone: result.card.phone ?? undefined,
    url: `${env.siteUrl}/card/${result.card.slug}`,
    worksFor: { '@type': 'Organization', name: settings.companyName, url: env.siteUrl },
  };

  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-ink-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Depth behind the card, so it reads as an object on a surface. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(201,162,39,0.22) 0%, transparent 60%), radial-gradient(ellipse 70% 45% at 85% 100%, rgba(30,156,179,0.18) 0%, transparent 58%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
        aria-hidden
      />

      <main className="relative flex min-h-dvh flex-col items-center justify-center px-5 py-12">
        <DigitalCard
          card={result.card}
          company={{
            name: settings.companyName,
            tagline: settings.tagline,
            phone: settings.primaryPhone,
            email: settings.primaryEmail,
            logoUrl: '/brand/mersam-mark.png',
          }}
          siteUrl={env.siteUrl}
        />

        <Link
          href="/"
          className="mt-10 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-400 transition-colors hover:text-gold-300"
        >
          {settings.companyName}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </main>
    </div>
  );
}
