import type { Metadata } from 'next';
import Image from 'next/image';
import { Award, HeartHandshake, Scale, Target } from 'lucide-react';
import { contentDeps } from '@infra/deps';
import {
  getSiteSettings,
  listActiveServices,
  listPublishedTestimonials,
} from '@app-layer/use-cases/content';
import { img, BLUR_DATA_URL } from '@/lib/media';
import { paragraphs } from '@/lib/utils';
import { CountUpValue, Parallax, Reveal } from '@/components/ui/motion';
import { PageBanner } from '@/components/site/page-banner';
import {
  CtaBand,
  ProcessSteps,
  SectionHeading,
  TestimonialCarousel,
} from '@/components/site/sections';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'About us',
  description:
    'MerSam is a Ghanaian water and plumbing engineering outfit covering the whole line, from the geophysical survey that finds the water to the pipework that delivers it.',
};

const VALUES = [
  {
    Icon: Scale,
    title: 'We quote on findings, not guesses',
    body: 'A survey, a water analysis or a site visit comes before a number. It costs us more up front and saves everyone the argument later.',
  },
  {
    Icon: Target,
    title: 'One team, one point of accountability',
    body: 'Drilling, treatment and plumbing under one roof means nobody can blame the other trade when something does not work.',
  },
  {
    Icon: Award,
    title: 'Everything is proved before handover',
    body: 'Pressure tests, yield tests and water analyses, issued as signed certificates rather than verbal assurances.',
  },
  {
    Icon: HeartHandshake,
    title: 'We leave people able to maintain it',
    body: 'Operator training and a spares pack on every scheme we build, because a system nobody can service is a system that fails.',
  },
];

export default async function AboutPage() {
  const deps = contentDeps();
  const [settings, services, testimonials] = await Promise.all([
    getSiteSettings(deps),
    listActiveServices(deps),
    listPublishedTestimonials(deps, 9),
  ]);

  return (
    <>
      <PageBanner
        eyebrow="Who we are"
        title={`${settings.companyName}, in our own words`}
        description={settings.tagline}
        imageKey="teamHands"
        breadcrumbs={[{ href: '/about', label: 'About' }]}
      />

      <section className="container-page py-16 sm:py-20">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <Reveal direction="right">
            <div className="relative">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem]">
                <Image
                  src={img('technicianAtWork', { width: 1200 })}
                  alt="A MerSam engineer working on a installation"
                  fill
                  sizes="(min-width: 1024px) 46vw, 92vw"
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                  className="object-cover"
                />
              </div>
              <Parallax strength={0.08} className="absolute -bottom-10 -right-5 hidden w-52 sm:block">
                <div className="overflow-hidden rounded-2xl border-4 border-[var(--surface)] shadow-[var(--shadow-float)]">
                  <Image
                    src={img('labSamples', { width: 600 })}
                    alt="Water samples being tested"
                    width={600}
                    height={420}
                    className="h-auto w-full object-cover"
                  />
                </div>
              </Parallax>
            </div>
          </Reveal>

          <Reveal direction="left" delay={80}>
            <div>
              <SectionHeading eyebrow="Our story" title="Built by people who do the work" />
              <div className="mt-5 space-y-4 text-base leading-relaxed text-[var(--text-secondary)]">
                {paragraphs(settings.about).map((block, index) => (
                  <p key={index}>{block}</p>
                ))}
              </div>

              <div className="mt-7 rounded-[var(--radius-card)] border-l-2 border-gold-500 bg-[var(--surface-sunken)] p-5">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--brand)]">
                  Our mission
                </p>
                <p className="mt-2 font-display text-lg italic text-[var(--text-primary)]">
                  {settings.mission}
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-ink-950 py-16 sm:py-20">
        <dl className="container-page grid grid-cols-2 gap-8 sm:grid-cols-4">
          {settings.stats.map((stat) => {
            const numeric = Number(stat.value.replace(/,/g, ''));
            return (
              <div key={stat.label} className="text-center">
                <dd className="font-display text-4xl font-semibold text-gradient-gold sm:text-5xl">
                  {Number.isFinite(numeric) ? (
                    <CountUpValue
                      value={numeric}
                      suffix={stat.suffix}
                      decimals={stat.value.includes('.') ? 1 : 0}
                    />
                  ) : (
                    `${stat.value}${stat.suffix}`
                  )}
                </dd>
                <dt className="mt-1.5 text-xs font-medium uppercase tracking-[0.1em] text-ink-300">
                  {stat.label}
                </dt>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="container-page py-16 sm:py-20">
        <Reveal>
          <SectionHeading
            eyebrow="What we hold to"
            title="Four things we will not trade away"
            align="center"
          />
        </Reveal>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {VALUES.map((value, index) => (
            <Reveal key={value.title} delay={index * 70}>
              <div className="flex h-full gap-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-gold-400/20 to-gold-700/10 text-[var(--brand)]">
                  <value.Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-sans text-base font-semibold text-[var(--text-primary)]">
                    {value.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {value.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-[var(--surface-sunken)] py-16 sm:py-20">
        <div className="container-page">
          <Reveal>
            <SectionHeading
              eyebrow="How we work"
              title="The same six steps, every job"
              align="center"
            />
          </Reveal>
          <div className="mt-10">
            <ProcessSteps />
          </div>
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="container-page py-16 sm:py-20">
          <Reveal>
            <SectionHeading eyebrow="In their words" title="What clients say afterwards" />
          </Reveal>
          <div className="mt-8">
            <TestimonialCarousel testimonials={testimonials} />
          </div>
        </section>
      )}

      <div className="pb-20 sm:pb-28">
        <CtaBand
          title={`${services.length} services, one number to call`}
          description="Whatever the water problem is, start with a conversation. We will tell you what it needs."
          phone={settings.primaryPhone}
        />
      </div>
    </>
  );
}
