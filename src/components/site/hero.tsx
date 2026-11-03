'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Pause, Phone, Play } from 'lucide-react';
import type { SiteSettings } from '@core/entities';
import { cn } from '@/lib/utils';
import { BLUR_DATA_URL } from '@/lib/media';
import { usePrefersReducedMotion } from '@/hooks';
import { ButtonLink } from '@/components/ui/button';
import { CountUpValue, RippleField } from '@/components/ui/motion';

const SLIDE_MS = 7000;

export function Hero({ settings }: { settings: SiteSettings }) {
  const slides = settings.heroSlides;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const reduced = usePrefersReducedMotion();
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  const goTo = useCallback(
    (next: number) => setIndex(((next % slides.length) + slides.length) % slides.length),
    [slides.length],
  );

  // Advance on a timer, but never while the tab is hidden or motion is reduced.
  useEffect(() => {
    if (!playing || reduced || slides.length < 2) return;
    timer.current = setInterval(() => setIndex((current) => (current + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(timer.current);
  }, [playing, reduced, slides.length]);

  useEffect(() => {
    const onVisibility = () => setPlaying(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (slides.length === 0) return null;
  const slide = slides[index]!;

  return (
    <section
      className="relative isolate flex min-h-[clamp(34rem,86svh,54rem)] flex-col justify-end overflow-hidden bg-ink-950"
      aria-roledescription="carousel"
      aria-label="Introduction"
    >
      {slides.map((item, slideIndex) => (
        <div
          key={item.headline}
          className={cn(
            'absolute inset-0 transition-opacity duration-1000 ease-[var(--ease-out-expo)]',
            slideIndex === index ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden={slideIndex !== index}
        >
          <Image
            src={item.imageUrl}
            alt=""
            fill
            // Only the first slide blocks the initial paint; the rest follow.
            priority={slideIndex === 0}
            loading={slideIndex === 0 ? 'eager' : 'lazy'}
            sizes="100vw"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className={cn(
              'object-cover transition-transform duration-[9000ms] ease-out',
              slideIndex === index && !reduced ? 'scale-110' : 'scale-100',
            )}
          />
        </div>
      ))}

      <div className="absolute inset-0 scrim-bottom" aria-hidden />
      <div
        className="absolute inset-0 opacity-45 mix-blend-soft-light"
        style={{ background: 'radial-gradient(ellipse at 22% 78%, #c9a227 0%, transparent 58%)' }}
        aria-hidden
      />
      <RippleField className="opacity-70" />

      <div className="container-page relative z-10 pb-14 pt-32 sm:pb-20">
        <div className="max-w-3xl">
          <p
            key={`eyebrow-${index}`}
            className="inline-flex items-center gap-2 rounded-full border border-gold-500/35 bg-ink-950/45 px-3.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-gold-300 backdrop-blur-sm"
            style={{ animation: 'fade-rise 0.7s var(--ease-out-expo) both' }}
          >
            <span className="size-1.5 rounded-full bg-gold-400" aria-hidden />
            {slide.eyebrow}
          </p>

          <h1
            key={`headline-${index}`}
            className="mt-5 font-display text-[clamp(2.25rem,6.2vw,4.5rem)] font-semibold text-white"
            style={{ animation: 'fade-rise 0.8s var(--ease-out-expo) 80ms both' }}
          >
            {slide.headline}
          </h1>

          <p
            key={`subhead-${index}`}
            className="mt-5 max-w-2xl text-base leading-relaxed text-ink-200 sm:text-lg"
            style={{ animation: 'fade-rise 0.8s var(--ease-out-expo) 160ms both' }}
          >
            {slide.subhead}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink
              href={slide.ctaHref}
              variant="gold"
              size="lg"
              trailingIcon={<ArrowRight className="size-4" aria-hidden />}
            >
              {slide.ctaLabel}
            </ButtonLink>
            <ButtonLink
              href={`tel:${settings.primaryPhone.replace(/\s/g, '')}`}
              size="lg"
              className="border border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
              leadingIcon={<Phone className="size-4" aria-hidden />}
            >
              {settings.primaryPhone}
            </ButtonLink>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-end justify-between gap-6 border-t border-white/12 pt-6">
          <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
            {settings.stats.map((stat) => {
              const numeric = Number(stat.value.replace(/,/g, ''));
              return (
                <div key={stat.label}>
                  <dt className="order-2 text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-ink-300">
                    {stat.label}
                  </dt>
                  <dd className="font-display text-3xl font-semibold text-gradient-gold sm:text-4xl">
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
                </div>
              );
            })}
          </dl>

          {slides.length > 1 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPlaying((current) => !current)}
                className="grid size-8 place-items-center rounded-full border border-white/25 text-white/80 transition-colors hover:bg-white/15"
                aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}
              >
                {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
              </button>
              <div className="flex items-center gap-2" role="tablist" aria-label="Choose slide">
                {slides.map((item, slideIndex) => (
                  <button
                    key={item.headline}
                    type="button"
                    role="tab"
                    aria-selected={slideIndex === index}
                    aria-label={`Slide ${slideIndex + 1}: ${item.eyebrow}`}
                    onClick={() => goTo(slideIndex)}
                    className={cn(
                      'h-1 rounded-full transition-all duration-500',
                      slideIndex === index ? 'w-10 bg-gold-400' : 'w-5 bg-white/30 hover:bg-white/55',
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes fade-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}`}</style>
    </section>
  );
}
