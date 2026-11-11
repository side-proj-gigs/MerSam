import type { ReactNode } from 'react';

export interface LegalSection {
  heading: string;
  /** Paragraphs. A null is skipped, so an optional fact can be inlined. */
  body?: (string | null)[];
  /** Definition style rows, for lists where each item needs a name. */
  list?: { term: string; detail: string }[];
}

/**
 * The frame both legal pages share.
 *
 * Legal text is usually set in a grey wall that nobody reads, which rather
 * defeats the point of publishing it. This keeps the body measure narrow, the
 * headings numbered and scannable, and gives a contents list at the top, so
 * somebody looking for one specific answer can find it without reading all of
 * it. Google also reviews these pages by hand when verifying an app, and a
 * reviewer who cannot find a section is a reviewer who rejects.
 */
export function LegalDocument({
  updated,
  intro,
  sections,
  footer,
}: {
  updated: string;
  intro: string;
  sections: LegalSection[];
  footer?: ReactNode;
}) {
  const slug = (heading: string) =>
    heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--brand)]">
        Last updated {updated}
      </p>
      <p className="mt-4 text-lg leading-relaxed text-[var(--text-secondary)]">{intro}</p>

      <nav
        aria-label="On this page"
        className="mt-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-5"
      >
        <p className="mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          On this page
        </p>
        <ol className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {sections.map((section, index) => (
            <li key={section.heading} className="flex gap-2">
              <span className="tabular-nums text-[var(--text-muted)]">{index + 1}.</span>
              <a
                href={`#${slug(section.heading)}`}
                className="text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--brand)] hover:underline"
              >
                {section.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-12 flex flex-col gap-11">
        {sections.map((section, index) => (
          <section key={section.heading} id={slug(section.heading)} className="scroll-mt-24">
            <h2 className="font-display text-xl font-bold tracking-[-0.01em] text-[var(--text-primary)] sm:text-2xl">
              <span className="mr-2.5 tabular-nums text-[var(--brand)]">{index + 1}.</span>
              {section.heading}
            </h2>

            <div className="mt-3 flex flex-col gap-3.5">
              {section.body?.filter(Boolean).map((paragraph, i) => (
                <p key={i} className="leading-relaxed text-[var(--text-secondary)]">
                  {paragraph}
                </p>
              ))}
            </div>

            {section.list && (
              <dl className="mt-5 flex flex-col gap-4 border-l-2 border-[var(--border-subtle)] pl-5">
                {section.list.map((item) => (
                  <div key={item.term}>
                    <dt className="font-semibold text-[var(--text-primary)]">{item.term}</dt>
                    <dd className="mt-1 leading-relaxed text-[var(--text-secondary)]">
                      {item.detail}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        ))}
      </div>

      {footer && (
        <p className="mt-12 border-t border-[var(--border-subtle)] pt-6 leading-relaxed text-[var(--text-secondary)]">
          {footer}
        </p>
      )}
    </article>
  );
}
