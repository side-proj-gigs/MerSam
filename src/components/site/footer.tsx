import Image from 'next/image';
import Link from 'next/link';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import type { ServiceWithCategory, SiteSettings } from '@core/entities';

function SocialIcon({ platform }: { platform: string }) {
  // Small inline marks keep the footer free of another icon dependency.
  const paths: Record<string, string> = {
    whatsapp:
      'M12.04 2a9.9 9.9 0 0 0-8.5 14.95L2 22l5.2-1.5A9.9 9.9 0 1 0 12.04 2Zm5.8 14.1c-.25.7-1.45 1.33-2 1.4-.52.06-1.17.09-1.88-.12a16 16 0 0 1-1.7-.63c-3-1.3-4.96-4.33-5.1-4.53-.16-.2-1.23-1.63-1.23-3.1 0-1.48.77-2.2 1.05-2.5.27-.3.6-.38.8-.38h.57c.18 0 .43-.07.67.51l.92 2.23c.08.15.13.33.03.53-.1.2-.15.32-.3.5l-.45.52c-.15.15-.3.32-.13.62.17.3.76 1.25 1.63 2.03 1.12 1 2.06 1.3 2.36 1.45.3.15.47.13.65-.08l.93-1.08c.2-.25.4-.2.67-.12l2.1 1c.3.14.5.21.57.33.07.12.07.7-.18 1.4Z',
    facebook: 'M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.25-1.5 1.55-1.5h1.65V4.6c-.3-.04-1.3-.13-2.45-.13-2.43 0-4.1 1.48-4.1 4.2v2.23H7.4V14h2.75v8h3.35Z',
    instagram:
      'M12 2.2c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.58 2.2 15.2 2.2 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.21 8.8 2.2 12 2.2Zm0 5.4a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8Zm0 7.26a2.86 2.86 0 1 1 0-5.72 2.86 2.86 0 0 1 0 5.72Zm5.6-7.44a1.03 1.03 0 1 1-2.06 0 1.03 1.03 0 0 1 2.06 0Z',
    linkedin:
      'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 21h4V9H3v12Zm7-12h3.8v1.65h.05c.53-1 1.82-2.05 3.75-2.05 4 0 4.75 2.6 4.75 6V21h-4v-5.6c0-1.33-.03-3.05-1.9-3.05-1.9 0-2.2 1.46-2.2 2.96V21h-4V9Z',
  };

  const path = paths[platform.toLowerCase()];
  if (!path) return null;

  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d={path} />
    </svg>
  );
}

export function SiteFooter({
  settings,
  services,
}: {
  settings: SiteSettings;
  services: ServiceWithCategory[];
}) {
  const year = new Date().getFullYear();
  const openDays = settings.businessHours.filter((hour) => !hour.isClosed);

  return (
    <footer className="relative mt-24 overflow-hidden bg-ink-950 text-ink-200">
      {/* A soft gold bloom behind the top edge, tying the footer to the logo. */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 size-[42rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #c9a227 0%, transparent 62%)' }}
        aria-hidden
      />

      <div className="container-page relative py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image
                src={settings.logoUrl || '/brand/mersam-icon.png'}
                alt=""
                width={48}
                height={48}
                className="size-11 object-contain"
              />
              <span className="font-display text-2xl font-semibold text-gradient-gold">
                {settings.companyName}
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-300">{settings.tagline}</p>

            <div className="mt-6 flex gap-2">
              {settings.socials.map((social) => (
                <a
                  key={social.platform}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid size-9 place-items-center rounded-full border border-ink-700 text-ink-300 transition-colors hover:border-gold-500 hover:text-gold-400"
                  aria-label={social.platform}
                >
                  <SocialIcon platform={social.platform} />
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-gold-400">
              Services
            </h2>
            <ul className="mt-4 space-y-2">
              {services.slice(0, 8).map((service) => (
                <li key={service.id}>
                  <Link
                    href={`/services/${service.slug}`}
                    className="text-sm text-ink-300 transition-colors hover:text-gold-300"
                  >
                    {service.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/services" className="text-sm font-semibold text-gold-400 hover:text-gold-300">
                  All services
                </Link>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-gold-400">
              Company
            </h2>
            <ul className="mt-4 space-y-2">
              {[
                { href: '/about', label: 'About us' },
                { href: '/projects', label: 'Projects' },
                { href: '/faq', label: 'FAQ' },
                { href: '/contact', label: 'Contact' },
                { href: '/admin', label: 'Staff login' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-300 transition-colors hover:text-gold-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-gold-400">
              Get in touch
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-gold-500" aria-hidden />
                <span className="text-ink-300">
                  {settings.addressLines.join(', ')}
                  {settings.addressLines.length > 0 && <br />}
                  {settings.city}, {settings.country}
                </span>
              </li>
              <li className="flex gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-gold-500" aria-hidden />
                <a
                  href={`tel:${settings.primaryPhone.replace(/\s/g, '')}`}
                  className="text-ink-300 transition-colors hover:text-gold-300"
                >
                  {settings.primaryPhone}
                </a>
              </li>
              <li className="flex gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-gold-500" aria-hidden />
                <a
                  href={`mailto:${settings.primaryEmail}`}
                  className="break-all text-ink-300 transition-colors hover:text-gold-300"
                >
                  {settings.primaryEmail}
                </a>
              </li>
              {openDays.length > 0 && (
                <li className="flex gap-2.5">
                  <Clock className="mt-0.5 size-4 shrink-0 text-gold-500" aria-hidden />
                  <span className="text-ink-300">
                    {openDays[0]!.day} to {openDays[openDays.length - 1]!.day}
                    <br />
                    {openDays[0]!.opensAt} to {openDays[0]!.closesAt}
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-ink-800 pt-6 text-xs text-ink-400 sm:flex-row">
          <p>
            {year} {settings.legalName || settings.companyName}. All rights reserved.
          </p>
          <p>
            Registered in {settings.country}
            {settings.region ? `, ${settings.region}` : ''}
          </p>
        </div>
      </div>
    </footer>
  );
}
