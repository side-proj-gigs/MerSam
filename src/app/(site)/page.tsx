import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Clock3, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { contentDeps } from '@infra/deps';
import { getHomepageBundle } from '@app-layer/use-cases/content';
import { img, BLUR_DATA_URL } from '@/lib/media';
import { paragraphs } from '@/lib/utils';
import { ButtonLink } from '@/components/ui/button';
import { Marquee, Parallax, Reveal, TiltCard } from '@/components/ui/motion';
import { Hero } from '@/components/site/hero';
import { EnquiryForm } from '@/components/site/enquiry-form';
import { ServiceCard } from '@/components/site/service-card';
import {
  CtaBand,
  FaqAccordion,
  ProcessSteps,
  ProjectCard,
  SectionHeading,
  TestimonialCarousel,
} from '@/components/site/sections';

const PROMISES = [
  { Icon: BadgeCheck, label: 'Surveyed before quoted' },
  { Icon: ShieldCheck, label: '24 month borehole warranty' },
  { Icon: Clock3, label: 'Same day emergency response' },
  { Icon: MapPin, label: 'Nationwide coverage' },
  { Icon: Sparkles, label: 'Itemised, transparent pricing' },
  { Icon: BadgeCheck, label: 'Signed test certificates' },
];

export default async function HomePage() {
  const { settings, services, categories, testimonials, projects, faqs } =
    await getHomepageBundle(contentDeps());

  const featured = services.filter((service) => service.isFeatured);
  const highlighted = featured.length > 0 ? featured : services.slice(0, 6);

  return (
    <>
      <Hero settings={settings} />

      {/* Trust strip. A quiet band that breaks the hero from the content. */}
      <section className="border-y border-[var(--border-subtle)] bg-[var(--surface-sunken)] py-5">
        <Marquee speedSeconds={42}>
          {PROMISES.map((promise, index) => (
            <span
              key={`${promise.label}-${index}`}
              className="flex shrink-0 items-center gap-2.5 text-sm font-medium text-[var(--text-secondary)]"
            >
              <promise.Icon className="size-4 text-[var(--brand)]" aria-hidden />
              {promise.label}
            </span>
          ))}
        </Marquee>
      </section>

      {/* ------------------------------------------------------------ services */}
      <section className="container-page py-20 sm:py-28">
        <Reveal>
          <SectionHeading
            eyebrow="What we do"
            title="Thirteen services, one accountable team"
            description="Water supply and plumbing are usually split between contractors who blame each other when something fails. We take the whole line, which means there is only ever one number to call."
            action={
              <ButtonLink
                href="/services"
                variant="outline"
                trailingIcon={<ArrowRight className="size-4" aria-hidden />}
              >
                All services
              </ButtonLink>
            }
          />
        </Reveal>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {highlighted.slice(0, 6).map((service, index) => (
            <Reveal key={service.id} delay={index * 60}>
              <TiltCard className="h-full">
                <ServiceCard service={service} priority={index < 3} className="h-full" />
              </TiltCard>
            </Reveal>
          ))}
        </div>

        {categories.length > 0 && (
          <Reveal delay={120}>
            <div className="mt-8 flex flex-wrap justify-center gap-2.5">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/services?category=${category.slug}`}
                  className="rounded-full border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                  style={{ borderLeftColor: category.accentColor, borderLeftWidth: 3 }}
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </Reveal>
        )}
      </section>

      {/* --------------------------------------------------------------- about */}
      <section className="relative overflow-hidden bg-[var(--surface-sunken)] py-20 sm:py-28">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <Reveal direction="right">
            <div className="relative">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] sm:aspect-[4/3] lg:aspect-[4/5]">
                <Image
                  src={img('technicianPortrait', { width: 1000 })}
                  alt="A MerSam engineer on site"
                  fill
                  sizes="(min-width: 1024px) 45vw, 92vw"
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                  className="object-cover"
                />
              </div>

              <Parallax strength={0.1} className="absolute -bottom-8 -right-4 hidden w-56 sm:block">
                <div className="overflow-hidden rounded-2xl border-4 border-[var(--surface-sunken)] shadow-[var(--shadow-float)]">
                  <Image
                    src={img('labTesting', { width: 600 })}
                    alt="Water quality testing in the laboratory"
                    width={600}
                    height={420}
                    className="h-auto w-full object-cover"
                  />
                </div>
              </Parallax>

              <div className="absolute -left-3 top-8 rounded-2xl bg-[var(--surface-raised)] px-4 py-3 shadow-[var(--shadow-float)] ring-1 ring-[var(--border-subtle)]">
                <p className="font-display text-2xl font-semibold text-gradient-gold">14 years</p>
                <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  On the tools
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal direction="left" delay={100}>
            <div>
              <SectionHeading eyebrow="Who we are" title={`Why people call ${settings.companyName}`} />
              <div className="mt-5 space-y-4 text-base leading-relaxed text-[var(--text-secondary)]">
                {paragraphs(settings.about).map((block, index) => (
                  <p key={index}>{block}</p>
                ))}
              </div>

              <blockquote className="mt-6 border-l-2 border-gold-500 pl-5 font-display text-lg italic text-[var(--text-primary)]">
                {settings.mission}
              </blockquote>

              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink
                  href="/about"
                  variant="primary"
                  trailingIcon={<ArrowRight className="size-4" aria-hidden />}
                >
                  More about us
                </ButtonLink>
                <ButtonLink href="/projects" variant="outline">
                  See our work
                </ButtonLink>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------- process */}
      <section className="container-page py-20 sm:py-28">
        <Reveal>
          <SectionHeading
            eyebrow="How we work"
            title="From the first call to the signed certificate"
            description="The same six steps on a dripping tap and on a community water scheme. The scale changes, the discipline does not."
            align="center"
          />
        </Reveal>
        <div className="mt-12">
          <ProcessSteps />
        </div>
      </section>

      {/* ------------------------------------------------------------ projects */}
      {projects.length > 0 && (
        <section className="container-page py-20 sm:py-28">
          <Reveal>
            <SectionHeading
              eyebrow="Recent work"
              title="Jobs we are happy to be measured on"
              description="Real sites, real figures. Every project below lists what was delivered and what it achieved."
              action={
                <ButtonLink
                  href="/projects"
                  variant="outline"
                  trailingIcon={<ArrowRight className="size-4" aria-hidden />}
                >
                  All projects
                </ButtonLink>
              }
            />
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 6).map((project, index) => (
              <Reveal key={project.id} delay={index * 60}>
                <ProjectCard project={project} priority={index < 2} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- testimonials */}
      {testimonials.length > 0 && (
        <section className="bg-[var(--surface-sunken)] py-20 sm:py-28">
          <div className="container-page">
            <Reveal>
              <SectionHeading
                eyebrow="In their words"
                title="What our clients say afterwards"
                description="Unedited, and specific about what actually happened on site."
              />
            </Reveal>
            <div className="mt-10">
              <TestimonialCarousel testimonials={testimonials} />
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------- enquiry */}
      <section className="container-page py-20 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-5">
          <Reveal className="lg:col-span-2">
            <div>
              <SectionHeading
                eyebrow="Get in touch"
                title="Tell us what is happening"
                description="Describe the problem in plain words. We will ask the technical questions when we call you back."
              />

              <dl className="mt-8 space-y-5">
                {[
                  { term: 'Call us', value: settings.primaryPhone, href: `tel:${settings.primaryPhone.replace(/\s/g, '')}` },
                  { term: 'Email us', value: settings.primaryEmail, href: `mailto:${settings.primaryEmail}` },
                  { term: 'Find us', value: `${settings.addressLines.join(', ')}, ${settings.city}` },
                ].map((item) => (
                  <div key={item.term}>
                    <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                      {item.term}
                    </dt>
                    <dd className="mt-0.5 text-base font-medium text-[var(--text-primary)]">
                      {item.href ? (
                        <a href={item.href} className="transition-colors hover:text-[var(--brand)]">
                          {item.value}
                        </a>
                      ) : (
                        item.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>

          <Reveal delay={100} className="lg:col-span-3">
            <EnquiryForm services={services} />
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------------------- FAQ */}
      {faqs.length > 0 && (
        <section className="container-page pb-20 sm:pb-28">
          <Reveal>
            <SectionHeading
              eyebrow="Questions"
              title="The things people ask before they commit"
              align="center"
            />
          </Reveal>
          <div className="mx-auto mt-10 max-w-3xl">
            <FaqAccordion faqs={faqs.slice(0, 8)} />
            <div className="mt-6 text-center">
              <ButtonLink href="/faq" variant="ghost">
                Read all questions
              </ButtonLink>
            </div>
          </div>
        </section>
      )}

      <div className="pb-20 sm:pb-28">
        <CtaBand
          title="Ready to stop worrying about your water?"
          description="Tell us the problem and we will tell you honestly what it will take to fix it, and what it will cost."
          phone={settings.primaryPhone}
        />
      </div>
    </>
  );
}
