'use client';

import { cn } from '@/lib/utils';

/**
 * The loading language for the whole product is water: a droplet that fills,
 * a surface that ripples, a level that rises. It is drawn in SVG and CSS so it
 * costs nothing to ship and animates on the compositor rather than the main
 * thread, which matters precisely when the page is busy.
 */

const SIZES = { sm: 28, md: 44, lg: 72, xl: 108 } as const;
export type LoaderSize = keyof typeof SIZES;

/** A droplet outline that fills with water on a loop. */
export function WaterDroplet({
  size = 'md',
  className,
  label = 'Loading',
}: {
  size?: LoaderSize;
  className?: string;
  label?: string;
}) {
  const px = SIZES[size];
  // Unique per instance so two loaders on one page cannot share a clip path.
  const id = `drop-${size}`;

  return (
    <span
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: px, height: px }}
      role="status"
      aria-label={label}
    >
      <svg viewBox="0 0 48 60" width={px} height={px} aria-hidden>
        <defs>
          <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e3c479" />
            <stop offset="45%" stopColor="#c9a227" />
            <stop offset="100%" stopColor="#8a671c" />
          </linearGradient>

          <clipPath id={`${id}-clip`}>
            {/* The classic droplet: a point at the top, a circle at the base. */}
            <path d="M24 2 C24 2 44 24.5 44 37 A20 20 0 0 1 4 37 C4 24.5 24 2 24 2 Z" />
          </clipPath>
        </defs>

        <path
          d="M24 2 C24 2 44 24.5 44 37 A20 20 0 0 1 4 37 C4 24.5 24 2 24 2 Z"
          fill="none"
          stroke={`url(#${id}-gold)`}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        <g clipPath={`url(#${id}-clip)`}>
          <g className="mersam-wave">
            {/* Two offset sine paths read as a moving surface rather than a bar. */}
            <path
              d="M-48 40 Q -36 34 -24 40 T 0 40 T 24 40 T 48 40 T 72 40 T 96 40 V 70 H -48 Z"
              fill={`url(#${id}-gold)`}
              opacity="0.9"
            />
            <path
              d="M-48 44 Q -36 38 -24 44 T 0 44 T 24 44 T 48 44 T 72 44 T 96 44 V 70 H -48 Z"
              fill="#1e9cb3"
              opacity="0.35"
            />
          </g>
        </g>
      </svg>

      <span className="sr-only">{label}</span>

      <style>{`
        .mersam-wave {
          animation: mersam-wave-x 2.1s linear infinite, mersam-wave-y 2.6s ease-in-out infinite;
        }
        @keyframes mersam-wave-x { from { transform: translateX(0); } to { transform: translateX(48px); } }
        @keyframes mersam-wave-y { 0%, 100% { translate: 0 6px; } 50% { translate: 0 -16px; } }
        @media (prefers-reduced-motion: reduce) {
          .mersam-wave { animation: none; translate: 0 -4px; }
        }
      `}</style>
    </span>
  );
}

/** Three droplets falling in sequence, for inline and button-sized waits. */
export function WaterDots({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} role="status" aria-label={label}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="mersam-dot size-1.5 rounded-full bg-[var(--brand)]"
          style={{ animationDelay: `${index * 140}ms` }}
        />
      ))}
      <span className="sr-only">{label}</span>
      <style>{`
        .mersam-dot { animation: mersam-drip 1.1s ease-in-out infinite; }
        @keyframes mersam-drip {
          0%, 100% { transform: translateY(0); opacity: 0.35; }
          50% { transform: translateY(-5px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) { .mersam-dot { animation: none; opacity: 0.7; } }
      `}</style>
    </span>
  );
}

/** Expanding rings, used where a droplet would be too literal. */
export function WaterRipple({ size = 'md', className }: { size?: LoaderSize; className?: string }) {
  const px = SIZES[size];

  return (
    <span
      className={cn('relative inline-block', className)}
      style={{ width: px, height: px }}
      role="status"
      aria-label="Loading"
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="mersam-ring absolute inset-0 rounded-full border-2 border-[var(--brand)]"
          style={{ animationDelay: `${index * 500}ms` }}
        />
      ))}
      <span className="absolute inset-[38%] rounded-full bg-[var(--brand)]" aria-hidden />
      <style>{`
        .mersam-ring { animation: mersam-ripple 1.9s cubic-bezier(0, 0.4, 0.4, 1) infinite; }
        @keyframes mersam-ripple {
          0% { transform: scale(0.25); opacity: 0.85; }
          100% { transform: scale(1); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) { .mersam-ring { animation: none; opacity: 0.3; } }
      `}</style>
    </span>
  );
}

/** A centred block for a whole page or panel that has nothing to show yet. */
export function LoadingPanel({
  message = 'Loading',
  hint,
  className,
}: {
  message?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 px-6 py-20', className)}>
      <WaterDroplet size="lg" label={message} />
      <div className="text-center">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{message}</p>
        {hint && <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
    </div>
  );
}
