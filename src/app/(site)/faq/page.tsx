import type { Metadata } from 'next';
import { contentDeps } from '@infra/deps';
import { getSiteSettings, listPublishedFaqs } from '@app-layer/use-cases/content';
import { Reveal } from '@/components/ui/motion';
import { EmptyState } from '@/components/ui/primitives';
import { PageBanner } from '@/components/site/page-banner';
import { CtaBand, FaqAccordion } from '@/components/site/sections';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description:
    'What a borehole costs in Ghana, whether you need a survey first, how often RO membranes need changing, how we price and what guarantee comes with the work.',
};

export default async function FaqPage() {
  const deps = contentDeps();
  const [settings, faqs] = await Promise.all([getSiteSettings(deps), listPublishedFaqs(deps)]);

  // The FAQPage schema lets these answers appear directly in search results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };

  return (
    <>
      {faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <PageBanner
        eyebrow="Questions"
        title="The things people ask before they commit"
        description="Straight answers on cost, timing, water quality and what happens if something goes wrong afterwards."
        imageKey="labBench"
        breadcrumbs={[{ href: '/faq', label: 'FAQ' }]}
      />

      <section className="container-page py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          {faqs.length === 0 ? (
            <EmptyState
              title="No questions published yet"
              description="Answers will appear here as they are added."
            />
          ) : (
            <Reveal>
              <FaqAccordion faqs={faqs} />
            </Reveal>
          )}
        </div>
      </section>

      <div className="pb-20 sm:pb-28">
        <CtaBand
          title="Still not answered?"
          description="Ask us directly. We would rather have the conversation than have you guess."
          phone={settings.primaryPhone}
        />
      </div>
    </>
  );
}
