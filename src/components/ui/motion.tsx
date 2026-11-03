'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useCountUp, useInView, usePrefersReducedMotion, useScrollProgress } from '@/hooks';

/**
 * The single entrance animation used across the public site. Everything fades
 * and lifts the same distance over the same duration, which is what makes a
 * long scrolling page feel composed rather than busy.
 */
export function Reveal({
  children,
  delay = 0,
  direction = 'up',
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article' | 'span';
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();

  const offsets = {
    up: 'translateY(28px)',
    down: 'translateY(-28px)',
    left: 'translateX(28px)',
    right: 'translateX(-28px)',
    none: 'none',
  };

  const horizontal = direction === 'left' || direction === 'right';

  return (
    <Tag
      ref={ref as never}
      className={className}
      // A horizontal reveal starts the element offset sideways, which widens
      // the scrollable area. On a narrow screen that shows up as the whole
      // page scrolling sideways, so the stylesheet swaps it for a vertical
      // one there. Done in CSS rather than JS so there is nothing to hydrate.
      data-reveal-axis={horizontal ? 'x' : 'y'}
      data-reveal={reduced || inView ? 'shown' : 'pending'}
      style={{
        opacity: reduced || inView ? 1 : 0,
        transform: reduced || inView ? 'none' : offsets[direction],
        transition: reduced
          ? undefined
          : `opacity 0.7s var(--ease-out-expo) ${delay}ms, transform 0.7s var(--ease-out-expo) ${delay}ms`,
        willChange: inView ? undefined : 'opacity, transform',
      }}
    >
      {children}
    </Tag>
  );
}

/** Staggers a list of children by a fixed step, so rows cascade in. */
export function RevealGroup({
  children,
  step = 70,
  className,
}: {
  children: ReactNode[];
  step?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <Reveal key={index} delay={index * step}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}

/** A thin gold line at the top of the viewport tracking read progress. */
export function ScrollProgressBar() {
  const progress = useScrollProgress();

  return (
    <div
      className="fixed inset-x-0 top-0 z-90 h-0.5 origin-left bg-gradient-to-r from-gold-600 via-gold-300 to-gold-500"
      style={{ transform: `scaleX(${progress})`, transition: 'transform 80ms linear' }}
      role="presentation"
    />
  );
}

export function CountUpValue({
  value,
  suffix = '',
  decimals = 0,
  className,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const current = useCountUp(value, 1600, inView);

  return (
    <span ref={ref} className={className}>
      {current.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/**
 * Shifts a background layer against the scroll. Capped at a small distance so
 * it reads as depth rather than as the page coming apart.
 */
export function Parallax({
  children,
  strength = 0.18,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const centre = rect.top + rect.height / 2 - window.innerHeight / 2;
      setOffset(Math.max(-80, Math.min(80, -centre * strength)));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [strength, reduced]);

  return (
    <div ref={ref} className={className} style={{ transform: `translate3d(0, ${offset}px, 0)` }}>
      {children}
    </div>
  );
}

/**
 * Tilts a card toward the pointer. Disabled on touch, where there is no hover
 * and the effect would only fight with scrolling.
 */
export function TiltCard({
  children,
  className,
  max = 6,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('none');
  const reduced = usePrefersReducedMotion();

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    setTransform(
      `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateZ(0)`,
    );
  };

  return (
    <div
      ref={ref}
      className={cn('transition-transform duration-300 ease-[var(--ease-out-expo)]', className)}
      style={{ transform }}
      onMouseMove={onMove}
      onMouseLeave={() => setTransform('none')}
    >
      {children}
    </div>
  );
}

/** A seamless horizontal loop, used for the trust strip. Pauses on hover. */
export function Marquee({
  children,
  speedSeconds = 38,
  className,
}: {
  children: ReactNode;
  speedSeconds?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return <div className={cn('flex gap-10 overflow-x-auto no-scrollbar', className)}>{children}</div>;
  }

  return (
    <div className={cn('group relative overflow-hidden mask-fade-r', className)}>
      <div
        className="flex w-max gap-10 group-hover:[animation-play-state:paused]"
        style={{ animation: `marquee-x ${speedSeconds}s linear infinite` }}
      >
        {children}
        <div className="flex gap-10" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Water ripples behind the hero, drawn with CSS rather than a canvas. */
export function RippleField({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return null;

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {[0, 1, 2, 3].map((index) => (
        <span
          key={index}
          className="absolute rounded-full border border-gold-400/20"
          style={{
            left: `${12 + index * 23}%`,
            top: `${28 + (index % 2) * 34}%`,
            width: `${90 + index * 26}px`,
            height: `${90 + index * 26}px`,
            animation: `ripple-out ${5 + index}s ease-out ${index * 1.3}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
