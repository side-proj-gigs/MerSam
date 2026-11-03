'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  HardHat,
  MessageSquare,
  Quote,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-react';
import type { FaqEntry, ProjectShowcase, Testimonial } from '@core/entities';
import { cn, formatDate, initials } from '@/lib/utils';
import { BLUR_DATA_URL } from '@/lib/media';
import { ButtonLink } from '@/components/ui/button';
import { Reveal } from '@/components/ui/motion';

/* --------------------------------------------------------------- heading */

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' && 'sm:flex-col sm:items-center',
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'text-center')}>
        {eyebrow && (
          <p className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
            {align === 'left' && <span className="h-px w-6 bg-[var(--brand)]" aria-hidden />}
            {eyebrow}
          </p>
        )}
        <h2 className="mt-3 font-display text-[clamp(1.75rem,3.6vw,2.75rem)] font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        {description && (
          <p className="mt-3 text-base leading-relaxed text-[var(--text-secondary)]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ----------------------------------------------------------- testimonials */

export function TestimonialCarousel({ testimonials }: { testimonials: Testimonial[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: true });

  const measure = () => {
    const node = track.current;
    if (!node) return;
    setCanScroll({
      left: node.scrollLeft > 8,
      right: node.scrollLeft + node.clientWidth < node.scrollWidth - 8,
    });
  };

  useEffect(() => {
    measure();
    const node = track.current;
    node?.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      node?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const nudge = (direction: 1 | -1) => {
    const node = track.current;
    if (!node) return;
    node.scrollBy({ left: direction * (node.clientWidth * 0.8), behavior: 'smooth' });
  };

  if (testimonials.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={track}
        className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2"
      >
        {testimonials.map((item) => (
          <figure
            key={item.id}
            className="flex w-[min(22rem,84vw)] shrink-0 snap-start flex-col rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-lift)]"
          >
            <Quote className="size-7 text-gold-500/45" aria-hidden />

            <div className="mt-3 flex gap-0.5" aria-label={`Rated ${item.rating} out of 5`}>
              {Array.from({ length: 5 }, (_, starIndex) => (
                <Star
                  key={starIndex}
                  className={cn(
                    'size-3.5',
                    starIndex < item.rating ? 'fill-gold-500 text-gold-500' : 'text-[var(--border-strong)]',
                  )}
                  aria-hidden
                />
              ))}
            </div>

            <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              {item.quote}
            </blockquote>

            <figcaption className="mt-5 flex items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-400 to-gold-700 text-sm font-bold text-ink-950">
                {initials(item.authorName)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
                  {item.authorName}
                </span>
                <span className="block truncate text-xs text-[var(--text-muted)]">
                  {[item.authorRole, item.location].filter(Boolean).join(', ')}
                </span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => nudge(-1)}
          disabled={!canScroll.left}
          className="grid size-10 place-items-center rounded-full border border-[var(--border-strong)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-35"
          aria-label="Previous testimonials"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => nudge(1)}
          disabled={!canScroll.right}
          className="grid size-10 place-items-center rounded-full border border-[var(--border-strong)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-35"
          aria-label="More testimonials"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- projects */

export function ProjectCard({
  project,
  priority = false,
}: {
  project: ProjectShowcase;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group relative block overflow-hidden rounded-[var(--radius-card)] bg-ink-900"
    >
      <div className="relative aspect-[4/3]">
        {project.coverImageUrl && (
          <Image
            src={project.coverImageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 48vw, 92vw"
            priority={priority}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.08]"
          />
        )}
        <div className="absolute inset-0 scrim-bottom" aria-hidden />
      </div>

      <div className="absolute inset-x-0 bottom-0 p-5">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-gold-300">
          {project.location}
        </p>
        <h3 className="mt-1.5 font-display text-lg font-semibold text-white">{project.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-ink-200">{project.summary}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem] text-ink-300">
          {project.stats.slice(0, 2).map((stat) => (
            <span key={stat.label}>
              <strong className="font-semibold text-gold-300">{stat.value}</strong> {stat.label}
            </span>
          ))}
          {project.completedOn && <span>{formatDate(project.completedOn, 'short')}</span>}
        </div>
      </div>
    </Link>
  );
}

/* -------------------------------------------------------------------- FAQ */

export function FaqAccordion({ faqs }: { faqs: FaqEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);

  const grouped = faqs.reduce<Record<string, FaqEntry[]>>((accumulator, item) => {
    (accumulator[item.category] ??= []).push(item);
    return accumulator;
  }, {});

  return (
    <div className="flex flex-col gap-8">
      {Object.entries(grouped).map(([category, entries]) => (
        <div key={category}>
          <h3 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--brand)]">
            {category}
          </h3>
          <div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)]">
            {entries.map((item) => {
              const open = openId === item.id;
              return (
                <div key={item.id}>
                  <h4>
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : item.id)}
                      aria-expanded={open}
                      aria-controls={`faq-${item.id}`}
                      className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--surface-sunken)]"
                    >
                      <span className="font-sans text-[0.9375rem] font-semibold text-[var(--text-primary)]">
                        {item.question}
                      </span>
                      <ChevronDown
                        className={cn(
                          'mt-0.5 size-4 shrink-0 text-[var(--text-muted)] transition-transform duration-300',
                          open && 'rotate-180',
                        )}
                        aria-hidden
                      />
                    </button>
                  </h4>
                  <div
                    id={`faq-${item.id}`}
                    hidden={!open}
                    className="px-5 pb-5 text-sm leading-relaxed text-[var(--text-secondary)]"
                  >
                    {item.answer}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- process */

const STEPS = [
  {
    Icon: MessageSquare,
    title: 'You tell us what is wrong',
    body: 'A call, a WhatsApp message or the form on this site. Describe the problem in your own words, we will ask the technical questions.',
  },
  {
    Icon: Search,
    title: 'We survey before we quote',
    body: 'A site visit, a water analysis or a geophysical survey, whichever the job calls for. We quote on findings rather than assumptions.',
  },
  {
    Icon: HardHat,
    title: 'The work gets done',
    body: 'Our own crew, our own equipment. You get a programme up front and we tell you straight away if anything changes it.',
  },
  {
    Icon: ClipboardCheck,
    title: 'We prove it works',
    body: 'Pressure tests, yield tests and water analyses, carried out before handover and issued as signed certificates.',
  },
  {
    Icon: FileText,
    title: 'You get the paperwork',
    body: 'An itemised invoice and, for larger works, a completion and payment report setting out exactly what was done and what was paid.',
  },
  {
    Icon: ShieldCheck,
    title: 'We stand behind it',
    body: 'Twelve months on plumbing workmanship, twenty four on borehole construction. If it fails in that window, we come back.',
  },
];

export function ProcessSteps() {
  return (
    <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {STEPS.map((step, index) => (
        <Reveal as="li" key={step.title} delay={index * 70}>
          <div className="group relative h-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 transition-colors hover:border-gold-500/45">
            <span
              className="absolute right-4 top-3 font-display text-5xl font-semibold text-[var(--surface-sunken)] transition-colors group-hover:text-gold-500/15"
              aria-hidden
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="relative grid size-11 place-items-center rounded-xl bg-gradient-to-br from-gold-400/20 to-gold-700/10 text-[var(--brand)]">
              <step.Icon className="size-5" aria-hidden />
            </span>
            <h3 className="relative mt-4 font-sans text-base font-semibold text-[var(--text-primary)]">
              {step.title}
            </h3>
            <p className="relative mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              {step.body}
            </p>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}

/* --------------------------------------------------------------- CTA band */

export function CtaBand({
  title,
  description,
  phone,
}: {
  title: string;
  description: string;
  phone: string;
}) {
  return (
    <section className="container-page">
      <div className="relative overflow-hidden rounded-[2rem] bg-ink-950 px-6 py-14 text-center sm:px-14 sm:py-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(ellipse at 20% 0%, #c9a22744 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, #1e9cb344 0%, transparent 55%)',
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-semibold text-white">
            {title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-200">{description}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink
              href="/contact"
              variant="gold"
              size="lg"
              trailingIcon={<ArrowRight className="size-4" aria-hidden />}
            >
              Request a quote
            </ButtonLink>
            <ButtonLink
              href={`tel:${phone.replace(/\s/g, '')}`}
              size="lg"
              className="border border-white/25 bg-white/10 text-white hover:bg-white/20"
            >
              Call {phone}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
