import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowUpRight,
  Droplets,
  Drill,
  Filter,
  Gauge,
  Layers,
  Radar,
  Search,
  ShowerHead,
  Spline,
  Sun,
  Users,
  Waves,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ServiceWithCategory } from '@core/entities';
import { cn, formatMoney } from '@/lib/utils';
import { BLUR_DATA_URL } from '@/lib/media';

/** Admins pick an icon by key, so the mapping lives in one place. */
const ICONS: Record<string, LucideIcon> = {
  droplets: Droplets,
  drill: Drill,
  filter: Filter,
  gauge: Gauge,
  layers: Layers,
  radar: Radar,
  search: Search,
  'shower-head': ShowerHead,
  spline: Spline,
  sun: Sun,
  users: Users,
  waves: Waves,
  wrench: Wrench,
};

export function ServiceIcon({ iconKey, className }: { iconKey: string; className?: string }) {
  const Icon = ICONS[iconKey] ?? Droplets;
  return <Icon className={className} aria-hidden />;
}

export function ServiceCard({
  service,
  priority = false,
  className,
}: {
  service: ServiceWithCategory;
  priority?: boolean;
  className?: string;
}) {
  const accent = service.category?.accentColor ?? '#c9a227';

  return (
    <Link
      href={`/services/${service.slug}`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[var(--shadow-lift)] transition-all duration-400 ease-[var(--ease-out-expo)] hover:-translate-y-1.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-float)]',
        className,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--surface-sunken)]">
        {service.heroImageUrl && (
          <Image
            src={service.heroImageUrl}
            alt=""
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 40vw, 92vw"
            priority={priority}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.07]"
          />
        )}
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-400 group-hover:opacity-100"
          style={{ background: `linear-gradient(to top, ${accent}44, transparent 58%)` }}
          aria-hidden
        />

        <span
          className="absolute left-3 top-3 grid size-10 place-items-center rounded-xl border border-white/25 bg-ink-950/55 text-white backdrop-blur-md"
          style={{ color: accent }}
          aria-hidden
        >
          <ServiceIcon iconKey={service.iconKey} className="size-5" />
        </span>

        {service.isFeatured && (
          <span className="absolute right-3 top-3 rounded-full bg-gold-500 px-2.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.08em] text-ink-950">
            Popular
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {service.category && (
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em]"
            style={{ color: accent }}
          >
            {service.category.name}
          </p>
        )}

        <h3 className="mt-1.5 font-display text-xl font-semibold text-[var(--text-primary)]">
          {service.name}
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">
          {service.summary}
        </p>

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
          <div>
            {service.startingPriceMinor !== null ? (
              <>
                <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  From
                </p>
                <p className="font-sans text-base font-bold text-[var(--text-primary)]">
                  {formatMoney(service.startingPriceMinor)}
                </p>
              </>
            ) : (
              <>
                <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Pricing
                </p>
                <p className="font-sans text-base font-bold text-[var(--text-primary)]">
                  Quoted per site
                </p>
              </>
            )}
          </div>

          <span
            className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] transition-all duration-300 group-hover:border-transparent group-hover:bg-gold-500 group-hover:text-ink-950"
            aria-hidden
          >
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:rotate-45" />
          </span>
        </div>
      </div>
    </Link>
  );
}
