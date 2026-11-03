import type { Metadata } from 'next';
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { contentDeps } from '@infra/deps';
import { getSiteSettings, listActiveServices } from '@app-layer/use-cases/content';
import { Reveal } from '@/components/ui/motion';
import { PageBanner } from '@/components/site/page-banner';
import { EnquiryForm } from '@/components/site/enquiry-form';
import { SectionHeading } from '@/components/site/sections';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Contact us',
  description:
    'Call, message or send an enquiry. MerSam covers Greater Accra for plumbing and maintenance, and the whole of Ghana for drilling and treatment works.',
};

export default async function ContactPage() {
  const deps = contentDeps();
  const [settings, services] = await Promise.all([
    getSiteSettings(deps),
    listActiveServices(deps),
  ]);

  const whatsapp = (settings.whatsappNumber ?? settings.primaryPhone).replace(/\D/g, '');

  const channels = [
    {
      Icon: Phone,
      label: 'Call us',
      value: settings.primaryPhone,
      href: `tel:${settings.primaryPhone.replace(/\s/g, '')}`,
      note: 'Emergency line open around the clock',
    },
    {
      Icon: MessageCircle,
      label: 'WhatsApp',
      value: settings.whatsappNumber ?? settings.primaryPhone,
      href: `https://wa.me/${whatsapp}`,
      note: 'Send photographs of the problem',
    },
    {
      Icon: Mail,
      label: 'Email',
      value: settings.primaryEmail,
      href: `mailto:${settings.primaryEmail}`,
      note: 'For quotes, drawings and documents',
    },
  ];

  // Helps the business appear correctly in local search and on maps.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Plumber',
    name: settings.companyName,
    image: settings.logoUrl,
    telephone: settings.primaryPhone,
    email: settings.primaryEmail,
    address: {
      '@type': 'PostalAddress',
      streetAddress: settings.addressLines.join(', '),
      addressLocality: settings.city,
      addressRegion: settings.region,
      addressCountry: settings.country,
    },
    openingHoursSpecification: settings.businessHours
      .filter((hour) => !hour.isClosed)
      .map((hour) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: hour.day,
        opens: hour.opensAt,
        closes: hour.closesAt,
      })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageBanner
        eyebrow="Get in touch"
        title="Tell us what is happening"
        description="Describe the problem in plain words. We will ask the technical questions when we call you back, usually within the same working day."
        imageKey="technicianPortrait"
        breadcrumbs={[{ href: '/contact', label: 'Contact' }]}
      />

      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-5 sm:grid-cols-3">
          {channels.map((channel, index) => (
            <Reveal key={channel.label} delay={index * 60}>
              <a
                href={channel.href}
                target={channel.href.startsWith('http') ? '_blank' : undefined}
                rel={channel.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="group flex h-full flex-col rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-float)]"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-gold-400/20 to-gold-700/10 text-[var(--brand)] transition-colors group-hover:from-gold-400/35">
                  <channel.Icon className="size-5" aria-hidden />
                </span>
                <p className="mt-4 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  {channel.label}
                </p>
                <p className="mt-1 break-words font-sans text-lg font-semibold text-[var(--text-primary)]">
                  {channel.value}
                </p>
                <p className="mt-1.5 text-xs text-[var(--text-muted)]">{channel.note}</p>
              </a>
            </Reveal>
          ))}
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-5">
          <Reveal className="lg:col-span-2">
            <div>
              <SectionHeading eyebrow="Visit us" title="Where to find us" />

              <div className="mt-6 flex flex-col gap-6">
                {settings.offices.map((office) => (
                  <div key={office.label} className="flex gap-3">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-sunken)] text-[var(--brand)]">
                      <MapPin className="size-4" aria-hidden />
                    </span>
                    <div>
                      <p className="font-sans text-sm font-semibold text-[var(--text-primary)]">
                        {office.label}
                      </p>
                      <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                        {office.addressLines.join(', ')}
                      </p>
                      {office.phone && (
                        <a
                          href={`tel:${office.phone.replace(/\s/g, '')}`}
                          className="mt-0.5 inline-block text-sm text-[var(--accent)] hover:underline"
                        >
                          {office.phone}
                        </a>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex gap-3">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-sunken)] text-[var(--brand)]">
                    <Clock className="size-4" aria-hidden />
                  </span>
                  <div>
                    <p className="font-sans text-sm font-semibold text-[var(--text-primary)]">
                      Opening hours
                    </p>
                    <dl className="mt-1.5 text-sm">
                      {settings.businessHours.map((hour) => (
                        <div
                          key={hour.day}
                          className="flex justify-between gap-6 border-b border-[var(--border-subtle)] py-1 last:border-0"
                        >
                          <dt className="text-[var(--text-secondary)]">{hour.day}</dt>
                          <dd
                            className={
                              hour.isClosed
                                ? 'text-[var(--text-muted)]'
                                : 'font-medium text-[var(--text-primary)]'
                            }
                          >
                            {hour.isClosed ? 'Closed' : `${hour.opensAt} to ${hour.closesAt}`}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={80} className="lg:col-span-3">
            <EnquiryForm services={services} />
          </Reveal>
        </div>
      </section>

      {settings.mapEmbedUrl && (
        <section className="container-page pb-20 sm:pb-28">
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)]">
            <iframe
              src={settings.mapEmbedUrl}
              title={`Map showing the ${settings.companyName} office`}
              className="h-[22rem] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </section>
      )}
    </>
  );
}
