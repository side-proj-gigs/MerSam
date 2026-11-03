import type { Metadata } from 'next';
import Link from 'next/link';
import { contentDeps } from '@infra/deps';
import {
  getSiteSettings,
  listActiveServices,
  listServiceCategories,
} from '@app-layer/use-cases/content';
import { Reveal, TiltCard } from '@/components/ui/motion';
import { ServiceCard } from '@/components/site/service-card';
import { CtaBand, SectionHeading } from '@/components/site/sections';
import { PageBanner } from '@/components/site/page-banner';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Our services',
  description:
    'Borehole drilling, geophysical surveys, water treatment, reverse osmosis, solar water heating, plumbing, pipe laying, leak detection, pressure testing and drainage works across Ghana.',
};

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const deps = contentDeps();
  const [settings, services, categories] = await Promise.all([
    getSiteSettings(deps),
    listActiveServices(deps),
    listServiceCategories(deps),
  ]);

  const selected = (await searchParams).category;
  const active = categories.find((category) => category.slug === selected) ?? null;
  const visible = active ? services.filter((service) => service.categoryId === active.id) : services;

  return (
    <>
      <PageBanner
        eyebrow="What we do"
        title={active ? active.name : 'Everything we do, under one roof'}
        description={
          active
            ? active.description
            : 'Thirteen services covering the whole line, from finding water underground to the tap it finally comes out of. One team, one point of accountability.'
        }
        imageKey="pipeGauges"
      />

      <section className="container-page py-16 sm:py-20">
        {/* Filtering is a plain link, so each category has a shareable URL and
            works without JavaScript. */}
        <nav className="flex flex-wrap gap-2" aria-label="Filter by category">
          <Link
            href="/services"
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                : 'border-transparent bg-[var(--text-primary)] text-[var(--text-inverse)]'
            }`}
            aria-current={active ? undefined : 'page'}
          >
            All {services.length}
          </Link>

          {categories.map((category) => {
            const count = services.filter((service) => service.categoryId === category.id).length;
            const isActive = active?.id === category.id;
            return (
              <Link
                key={category.id}
                href={`/services?category=${category.slug}`}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-transparent bg-[var(--text-primary)] text-[var(--text-inverse)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                style={isActive ? undefined : { borderLeftColor: category.accentColor, borderLeftWidth: 3 }}
                aria-current={isActive ? 'page' : undefined}
              >
                {category.name} {count}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((service, index) => (
            <Reveal key={service.id} delay={Math.min(index, 5) * 55}>
              <TiltCard className="h-full">
                <ServiceCard service={service} priority={index < 3} className="h-full" />
              </TiltCard>
            </Reveal>
          ))}
        </div>

        {visible.length === 0 && (
          <p className="py-16 text-center text-[var(--text-muted)]">
            Nothing is listed under this category yet.
          </p>
        )}
      </section>

      <section className="container-page pb-16 sm:pb-20">
        <Reveal>
          <SectionHeading
            eyebrow="Not sure which you need?"
            title="Describe the problem and we will tell you"
            description="Most people call us about a symptom rather than a service. Tell us what you are seeing and we will work out what it will take to fix."
            align="center"
          />
        </Reveal>
      </section>

      <div className="pb-20 sm:pb-28">
        <CtaBand
          title="Book a site visit"
          description="We survey before we quote, so the number we give you is the number you pay."
          phone={settings.primaryPhone}
        />
      </div>
    </>
  );
}
