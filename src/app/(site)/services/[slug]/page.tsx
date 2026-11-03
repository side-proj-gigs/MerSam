import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Check, Clock3, Wallet } from 'lucide-react';
import { isAppError } from '@core/errors';
import { contentDeps } from '@infra/deps';
import {
  getServiceBySlug,
  getSiteSettings,
  listActiveServices,
  listPublishedProjects,
} from '@app-layer/use-cases/content';
import { BLUR_DATA_URL } from '@/lib/media';
import { formatMoney, paragraphs } from '@/lib/utils';
import { ButtonLink } from '@/components/ui/button';
import { Reveal } from '@/components/ui/motion';
import { PageBanner } from '@/components/site/page-banner';
import { EnquiryForm } from '@/components/site/enquiry-form';
import { ServiceCard, ServiceIcon } from '@/components/site/service-card';
import { ProjectCard, SectionHeading } from '@/components/site/sections';

export const revalidate = 300;

/** Pre-renders every service at build time; new ones render on first request. */
export async function generateStaticParams() {
  const services = await listActiveServices(contentDeps());
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const service = await getServiceBySlug(contentDeps(), slug);
    return {
      title: service.seoTitle ?? service.name,
      description: service.seoDescription ?? service.summary,
      openGraph: {
        title: service.name,
        description: service.summary,
        images: service.heroImageUrl ? [{ url: service.heroImageUrl }] : undefined,
      },
    };
  } catch {
    return { title: 'Service not found' };
  }
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const deps = contentDeps();

  const service = await getServiceBySlug(deps, slug).catch((error) => {
    if (isAppError(error) && error.code === 'NOT_FOUND') notFound();
    throw error;
  });

  const [settings, allServices, projects] = await Promise.all([
    getSiteSettings(deps),
    listActiveServices(deps),
    listPublishedProjects(deps),
  ]);

  const related = allServices
    .filter((item) => item.id !== service.id && item.categoryId === service.categoryId)
    .slice(0, 3);

  const caseStudies = projects.filter((project) => project.serviceId === service.id).slice(0, 3);

  // Structured data helps this page show up for the service in search results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.summary,
    provider: {
      '@type': 'LocalBusiness',
      name: settings.companyName,
      telephone: settings.primaryPhone,
      email: settings.primaryEmail,
      address: {
        '@type': 'PostalAddress',
        streetAddress: settings.addressLines.join(', '),
        addressLocality: settings.city,
        addressRegion: settings.region,
        addressCountry: settings.country,
      },
    },
    areaServed: settings.country,
    ...(service.startingPriceMinor !== null && {
      offers: {
        '@type': 'Offer',
        price: (service.startingPriceMinor / 100).toFixed(2),
        priceCurrency: settings.defaultCurrency,
      },
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageBanner
        eyebrow={service.category?.name ?? 'Service'}
        title={service.name}
        description={service.tagline || service.summary}
        imageUrl={service.heroImageUrl}
        breadcrumbs={[
          { href: '/services', label: 'Services' },
          { href: `/services/${service.slug}`, label: service.name },
        ]}
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink
            href="#enquire"
            variant="gold"
            size="lg"
            trailingIcon={<ArrowRight className="size-4" aria-hidden />}
          >
            Request a quote
          </ButtonLink>
          <ButtonLink
            href={`tel:${settings.primaryPhone.replace(/\s/g, '')}`}
            size="lg"
            className="border border-white/25 bg-white/10 text-white hover:bg-white/20"
          >
            Call {settings.primaryPhone}
          </ButtonLink>
        </div>
      </PageBanner>

      {/* Key facts, stated plainly rather than buried in prose. */}
      <section className="border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)]">
        <div className="container-page grid gap-6 py-7 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-raised)] text-[var(--brand)]">
              <Wallet className="size-4.5" aria-hidden />
            </span>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Indicative price
              </p>
              <p className="mt-0.5 font-sans text-base font-bold text-[var(--text-primary)]">
                {service.startingPriceMinor !== null
                  ? `From ${formatMoney(service.startingPriceMinor)}`
                  : 'Quoted per site'}
              </p>
              {service.priceNote && (
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{service.priceNote}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-raised)] text-[var(--brand)]">
              <Clock3 className="size-4.5" aria-hidden />
            </span>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Typical turnaround
              </p>
              <p className="mt-0.5 font-sans text-base font-bold text-[var(--text-primary)]">
                {service.turnaround || 'Agreed at survey'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-raised)] text-[var(--brand)]">
              <ServiceIcon iconKey={service.iconKey} className="size-4.5" />
            </span>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Category
              </p>
              <p className="mt-0.5 font-sans text-base font-bold text-[var(--text-primary)]">
                {service.category?.name ?? 'General'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal>
              <div className="prose-mersam space-y-4 text-base leading-relaxed text-[var(--text-secondary)]">
                {paragraphs(service.body).map((block, index) => (
                  <p key={index}>{block}</p>
                ))}
              </div>
            </Reveal>

            {service.features.length > 0 && (
              <Reveal delay={80}>
                <div className="mt-10">
                  <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
                    How we approach it
                  </h2>
                  <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                    {service.features.map((feature) => (
                      <div
                        key={feature.title}
                        className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5"
                      >
                        <dt className="font-sans text-sm font-semibold text-[var(--text-primary)]">
                          {feature.title}
                        </dt>
                        <dd className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                          {feature.detail}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </Reveal>
            )}

            {service.galleryUrls.length > 0 && (
              <Reveal delay={120}>
                <div className="mt-10 grid grid-cols-2 gap-3">
                  {service.galleryUrls.slice(0, 4).map((url, index) => (
                    <div
                      key={url}
                      className={`relative overflow-hidden rounded-xl ${
                        index === 0 ? 'col-span-2 aspect-[16/9]' : 'aspect-[4/3]'
                      }`}
                    >
                      <Image
                        src={url}
                        alt={`${service.name} work in progress`}
                        fill
                        sizes="(min-width: 1024px) 30vw, 46vw"
                        placeholder="blur"
                        blurDataURL={BLUR_DATA_URL}
                        className="object-cover transition-transform duration-700 hover:scale-105"
                      />
                    </div>
                  ))}
                </div>
              </Reveal>
            )}
          </div>

          <aside className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              {service.deliverables.length > 0 && (
                <Reveal direction="left">
                  <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6">
                    <h2 className="font-sans text-base font-semibold text-[var(--text-primary)]">
                      What you receive
                    </h2>
                    <ul className="mt-4 flex flex-col gap-2.5">
                      {service.deliverables.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-sm">
                          <span
                            className="mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-success)_18%,transparent)] text-[var(--color-success)]"
                            aria-hidden
                          >
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                          <span className="text-[var(--text-secondary)]">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              )}

              <Reveal direction="left" delay={80}>
                <div className="mt-5 overflow-hidden rounded-[var(--radius-card)] bg-ink-950 p-6">
                  <p className="font-display text-xl font-semibold text-white">
                    Need this looked at urgently?
                  </p>
                  <p className="mt-2 text-sm text-ink-300">
                    Our emergency line runs around the clock for burst pipes and total loss of
                    supply.
                  </p>
                  <ButtonLink
                    href={`tel:${settings.primaryPhone.replace(/\s/g, '')}`}
                    variant="gold"
                    className="mt-4 w-full"
                  >
                    {settings.primaryPhone}
                  </ButtonLink>
                </div>
              </Reveal>
            </div>
          </aside>
        </div>
      </section>

      {caseStudies.length > 0 && (
        <section className="container-page pb-16 sm:pb-20">
          <Reveal>
            <SectionHeading eyebrow="Proof" title={`${service.name} we have delivered`} />
          </Reveal>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {caseStudies.map((project, index) => (
              <Reveal key={project.id} delay={index * 60}>
                <ProjectCard project={project} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <section id="enquire" className="container-page scroll-mt-24 pb-16 sm:pb-20">
        <div className="grid gap-10 lg:grid-cols-5">
          <Reveal className="lg:col-span-2">
            <SectionHeading
              eyebrow="Get a quote"
              title={`Ask us about ${service.name.toLowerCase()}`}
              description="Tell us what you need and we will come back with a realistic price and timeline, usually the same working day."
            />
          </Reveal>
          <Reveal delay={80} className="lg:col-span-3">
            <EnquiryForm services={allServices} defaultServiceId={service.id} />
          </Reveal>
        </div>
      </section>

      {related.length > 0 && (
        <section className="container-page pb-20 sm:pb-28">
          <Reveal>
            <SectionHeading
              eyebrow="Related"
              title="Other work in this area"
              action={
                <Link
                  href="/services"
                  className="text-sm font-semibold text-[var(--accent)] hover:underline"
                >
                  All services
                </Link>
              }
            />
          </Reveal>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item, index) => (
              <Reveal key={item.id} delay={index * 60}>
                <ServiceCard service={item} className="h-full" />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
