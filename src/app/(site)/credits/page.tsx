import type { Metadata } from 'next';
import Link from 'next/link';
import { IMAGE_CREDITS, requiresAttribution } from '@/lib/image-credits';
import { PageBanner } from '@/components/site/page-banner';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Photograph credits',
  description:
    'Who took the photographs used on this site, and the licence each one is published under.',
};

/**
 * Attribution for the photographs that require it.
 *
 * Several of the service photographs are Creative Commons, which obliges us
 * to name the photographer and the licence. A credits page is the normal way
 * a website discharges that, and it costs nothing to be straight about it.
 *
 * Generated from the same list the install script reads, so a photograph
 * cannot be swapped without its credit following it.
 */
export default function CreditsPage() {
  const attributed = IMAGE_CREDITS.filter(requiresAttribution);
  const free = IMAGE_CREDITS.filter((credit) => !requiresAttribution(credit));

  return (
    <>
      <PageBanner
        eyebrow="Legal"
        title="Photograph credits"
        description="Who took the pictures on this site, and under what terms we are using them."
      />

      <article className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
        <p className="text-lg leading-relaxed text-[var(--text-secondary)]">
          Photographs of our own completed work are our own. Where a service is illustrated with
          someone else{'’'}s photograph, it is published under a licence that permits reuse,
          and the photographer is named below as that licence requires.
        </p>

        <h2 className="mt-12 font-display text-xl font-bold text-[var(--text-primary)]">
          Creative Commons
        </h2>
        <p className="mt-2 leading-relaxed text-[var(--text-secondary)]">
          Used with attribution under the licence shown. Follow a licence link for its exact terms.
        </p>

        <ul className="mt-6 flex flex-col divide-y divide-[var(--border-subtle)]">
          {attributed.map((credit) => (
            <li key={credit.file} className="py-4">
              <p className="font-semibold text-[var(--text-primary)]">{credit.caption}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {credit.author}
                {', '}
                {credit.licenceUrl ? (
                  <a
                    className="text-[var(--brand)] underline"
                    href={credit.licenceUrl}
                    rel="noreferrer noopener license"
                    target="_blank"
                  >
                    {credit.licence}
                  </a>
                ) : (
                  credit.licence
                )}
                {', via '}
                <a
                  className="text-[var(--brand)] underline"
                  href={credit.source}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  Wikimedia Commons
                </a>
              </p>
            </li>
          ))}
        </ul>

        {free.length > 0 && (
          <>
            <h2 className="mt-12 font-display text-xl font-bold text-[var(--text-primary)]">
              Public domain
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--text-secondary)]">
              No attribution is required for these. They are listed so the source of every
              photograph on this site can be checked.
            </p>
            <ul className="mt-6 flex flex-col divide-y divide-[var(--border-subtle)]">
              {free.map((credit) => (
                <li key={credit.file} className="py-4">
                  <p className="font-semibold text-[var(--text-primary)]">{credit.caption}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {credit.author}
                    {', '}
                    <a
                      className="text-[var(--brand)] underline"
                      href={credit.source}
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      Wikimedia Commons
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="mt-12 border-t border-[var(--border-subtle)] pt-6 leading-relaxed text-[var(--text-secondary)]">
          If you are the photographer of any image here and something is credited wrongly, write to
          us and we will correct it or take it down. Our{' '}
          <Link className="text-[var(--brand)] underline" href="/terms">
            terms of service
          </Link>{' '}
          cover the rest of the site{'’'}s content.
        </p>
      </article>
    </>
  );
}
