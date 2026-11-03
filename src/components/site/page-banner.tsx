import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { img, BLUR_DATA_URL, type PhotoKey } from '@/lib/media';

/**
 * The standard header for every page below the homepage. Keeping one component
 * means the breadcrumb, the scrim and the heading rhythm match everywhere.
 */
export function PageBanner({
  eyebrow,
  title,
  description,
  imageKey,
  imageUrl,
  breadcrumbs = [],
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  imageKey?: PhotoKey;
  imageUrl?: string;
  breadcrumbs?: { href: string; label: string }[];
  children?: React.ReactNode;
}) {
  const source = imageUrl ?? (imageKey ? img(imageKey, { width: 1920, quality: 70 }) : null);

  return (
    <section className="relative isolate overflow-hidden bg-ink-950">
      {source && (
        <Image
          src={source}
          alt=""
          fill
          priority
          sizes="100vw"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-cover opacity-45"
        />
      )}
      <div className="absolute inset-0 scrim-bottom" aria-hidden />
      <div
        className="absolute inset-0 opacity-45 mix-blend-soft-light"
        style={{ background: 'radial-gradient(ellipse at 18% 85%, #c9a227 0%, transparent 60%)' }}
        aria-hidden
      />

      <div className="container-page relative py-16 sm:py-24">
        {breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-300">
              <li>
                <Link href="/" className="transition-colors hover:text-gold-300">
                  Home
                </Link>
              </li>
              {breadcrumbs.map((crumb, index) => (
                <li key={crumb.href} className="flex items-center gap-1">
                  <ChevronRight className="size-3" aria-hidden />
                  {index === breadcrumbs.length - 1 ? (
                    <span className="text-gold-300" aria-current="page">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link href={crumb.href} className="transition-colors hover:text-gold-300">
                      {crumb.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {eyebrow && (
          <p className="inline-flex items-center gap-2 rounded-full border border-gold-500/35 bg-ink-950/40 px-3.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-gold-300 backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-gold-400" aria-hidden />
            {eyebrow}
          </p>
        )}

        <h1 className="mt-5 max-w-3xl font-display text-[clamp(2rem,5vw,3.5rem)] font-semibold text-white">
          {title}
        </h1>

        {description && (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-200 sm:text-lg">
            {description}
          </p>
        )}

        {children}
      </div>
    </section>
  );
}
