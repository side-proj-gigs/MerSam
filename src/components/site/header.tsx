'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronDown, Menu, Phone, X } from 'lucide-react';
import type { ServiceWithCategory, SiteSettings } from '@core/entities';
import { cn } from '@/lib/utils';
import { useScrolledPast, useScrollLock } from '@/hooks';
import { ButtonLink } from '@/components/ui/button';
import { ThemeToggle } from './theme-toggle';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services', hasMenu: true },
  { href: '/projects', label: 'Projects' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader({
  settings,
  services,
}: {
  settings: SiteSettings;
  services: ServiceWithCategory[];
}) {
  const pathname = usePathname();
  const scrolled = useScrolledPast(16);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useScrollLock(drawerOpen);

  // Any navigation closes whatever was open, including a back button press.
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const featured = services.filter((service) => service.isFeatured).slice(0, 6);

  return (
    <>
      {settings.emergencyBannerEnabled && settings.emergencyBannerText && (
        <div className="bg-gradient-to-r from-gold-700 via-gold-500 to-gold-700 text-ink-950">
          <div className="container-page flex items-center justify-center gap-2 py-1.5 text-center text-[0.8125rem] font-semibold">
            <Phone className="size-3.5 shrink-0" aria-hidden />
            <span>{settings.emergencyBannerText}</span>
          </div>
        </div>
      )}

      <header
        className={cn(
          'sticky top-0 z-80 transition-all duration-300 ease-[var(--ease-out-expo)]',
          scrolled
            ? 'surface-glass border-b border-[var(--border-subtle)] shadow-[var(--shadow-lift)]'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-20">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${settings.companyName} home`}>
            <Image
              src={settings.logoUrl || '/brand/mersam-icon.png'}
              alt=""
              width={44}
              height={44}
              priority
              className="size-9 object-contain lg:size-11"
            />
            <span className="font-display text-xl font-semibold tracking-[-0.02em] lg:text-2xl">
              <span className="text-gradient-gold">{settings.companyName}</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
            {NAV.map((item) =>
              item.hasMenu && featured.length > 0 ? (
                <div
                  key={item.href}
                  className="relative"
                  onMouseEnter={() => setMenuOpen(true)}
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                    )}
                    aria-expanded={menuOpen}
                  >
                    {item.label}
                    <ChevronDown
                      className={cn('size-3.5 transition-transform duration-200', menuOpen && 'rotate-180')}
                      aria-hidden
                    />
                  </Link>

                  {menuOpen && (
                    <div className="absolute left-1/2 top-full w-[34rem] -translate-x-1/2 pt-2">
                      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-float)]">
                        {featured.map((service) => (
                          <Link
                            key={service.id}
                            href={`/services/${service.slug}`}
                            className="group flex flex-col gap-0.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-sunken)]"
                          >
                            <span className="text-sm font-semibold text-[var(--text-primary)]">
                              {service.name}
                            </span>
                            <span className="line-clamp-1 text-xs text-[var(--text-muted)]">
                              {service.tagline}
                            </span>
                          </Link>
                        ))}
                        <Link
                          href="/services"
                          className="col-span-2 mt-1 rounded-xl bg-[var(--surface-sunken)] px-3 py-2.5 text-center text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--border-subtle)]"
                        >
                          View all {services.length} services
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:inline-flex" />
            <ButtonLink
              href={`tel:${settings.primaryPhone.replace(/\s/g, '')}`}
              variant="ghost"
              size="sm"
              className="hidden xl:inline-flex"
              leadingIcon={<Phone className="size-4" aria-hidden />}
            >
              {settings.primaryPhone}
            </ButtonLink>
            <ButtonLink href="/contact" variant="gold" size="sm" className="hidden sm:inline-flex">
              Request a quote
            </ButtonLink>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="grid size-10 place-items-center rounded-lg text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-sunken)] lg:hidden"
              aria-label="Open menu"
              aria-expanded={drawerOpen}
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-100 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
            tabIndex={-1}
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(21rem,88vw)] flex-col bg-[var(--surface-raised)] shadow-[var(--shadow-float)]">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
              <span className="font-display text-lg font-semibold text-gradient-gold">
                {settings.companyName}
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-sunken)]"
                aria-label="Close menu"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Mobile">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'block rounded-xl px-3 py-3 text-base font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-[var(--surface-sunken)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]',
                  )}
                >
                  {item.label}
                </Link>
              ))}

              <p className="mt-5 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Our services
              </p>
              <div className="mt-1.5">
                {services.slice(0, 13).map((service) => (
                  <Link
                    key={service.id}
                    href={`/services/${service.slug}`}
                    className="block rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
                  >
                    {service.name}
                  </Link>
                ))}
              </div>
            </nav>

            <div className="flex flex-col gap-2 border-t border-[var(--border-subtle)] p-4">
              <ThemeToggle className="self-center" />
              <ButtonLink href="/contact" variant="gold" size="md">
                Request a quote
              </ButtonLink>
              <ButtonLink
                href={`tel:${settings.primaryPhone.replace(/\s/g, '')}`}
                variant="outline"
                size="md"
                leadingIcon={<Phone className="size-4" aria-hidden />}
              >
                {settings.primaryPhone}
              </ButtonLink>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
