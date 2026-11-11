import type { Metadata } from 'next';
import Link from 'next/link';
import { getSiteSettings } from '@app-layer/use-cases/content';
import { contentDeps } from '@infra/deps';
import { PageBanner } from '@/components/site/page-banner';
import { LegalDocument, type LegalSection } from '@/components/site/legal-document';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Terms of service',
  description:
    'The terms on which this website may be used, how quotations work, and where responsibility sits.',
};

export default async function TermsPage() {
  const settings = await getSiteSettings(contentDeps());
  const company = settings.legalName || settings.companyName;

  const sections: LegalSection[] = [
    {
      heading: 'These terms',
      body: [
        `This website is operated by ${company}. By using it you accept the terms below. If you do not, please do not use the site.`,
        'Nothing here affects your rights under Ghanaian consumer law, which stand whatever this page says.',
      ],
    },
    {
      heading: 'What this website is for',
      body: [
        'The site describes the water engineering and plumbing services we offer, shows work we have completed, and lets you ask us for a quotation.',
        'It is informational. Submitting the quote form starts a conversation; it does not book a job and it does not create a contract between us.',
      ],
    },
    {
      heading: 'Prices and quotations',
      body: [
        'Any price shown on this site is indicative. Borehole depth, water chemistry, access to the site and the condition of existing pipework all change what a job costs, and none of them can be known from a web page.',
        'A binding price exists only in a written quotation or proposal issued to you by name, and it holds for the validity period stated on that document. If the scope changes once work begins, we quote the change before carrying it out.',
        'Figures quoted are in Ghana cedis unless the document says otherwise.',
      ],
    },
    {
      heading: 'Work we carry out',
      body: [
        'Work is governed by the quotation or proposal you accepted, together with any terms printed on it. Where this page and that document disagree, that document wins.',
        'We guarantee our workmanship and issue the relevant test certificates at handover. Materials carry whatever warranty their manufacturer provides, which we pass on to you in full.',
        'A guarantee does not cover damage from misuse, from alteration by somebody else, or from a fault in parts of the system we did not install.',
      ],
    },
    {
      heading: 'Using the site properly',
      body: ['You agree not to:'],
      list: [
        {
          term: 'Submit the form dishonestly',
          detail:
            'No false details, no enquiries on somebody else’s behalf without their knowledge, and nothing automated. The form is rate limited and abuse is blocked.',
        },
        {
          term: 'Interfere with the site',
          detail:
            'No attempt to break into the staff area, to probe for weaknesses, or to disrupt the service for anybody else.',
        },
        {
          term: 'Take the content',
          detail:
            'The text, photographs, layout and marks on this site belong to us or to our licensors. Read them, share a link to them, quote them with attribution. Do not republish them as your own.',
        },
      ],
    },
    {
      heading: 'Accuracy',
      body: [
        'We keep the site current, but we do not promise that every detail is complete or free of error at every moment. Availability of a particular material, a turnaround time, a photograph of a past job: these change.',
        'Nothing on the site is engineering advice for your specific situation. A borehole or a treatment plant has to be designed for the water and the ground at your site, which is what a survey is for.',
      ],
    },
    {
      heading: 'Availability',
      body: [
        'We would like the site to be available all the time and it will not be. It depends on hosting and network providers, and we may take it down for maintenance without notice.',
        'If it is unavailable when you need us, call us. The number is at the top of every page.',
      ],
    },
    {
      heading: 'Responsibility',
      body: [
        'We are responsible for what we do: the work we carry out, and the obligations in a quotation you accepted.',
        'We are not responsible for loss caused by your reliance on indicative information on this site in place of a written quotation, for a third party’s services linked from here, or for matters outside our reasonable control.',
        'Nothing in these terms limits our liability for death or personal injury caused by our negligence, or for fraud. No business can limit those, and we are not trying to.',
      ],
    },
    {
      heading: 'Your information',
      body: [
        'What we collect through this site and what we do with it is set out in full in our privacy policy, which forms part of these terms.',
      ],
    },
    {
      heading: 'Changes, and the law that applies',
      body: [
        'We may change these terms. The version published here when you use the site is the one that applies, and the date at the top tells you when it last changed.',
        `These terms are governed by the laws of ${settings.country}, and its courts have jurisdiction over any dispute arising from them.`,
      ],
    },
  ];

  return (
    <>
      <PageBanner
        eyebrow="Legal"
        title="Terms of service"
        description="The basis on which this website may be used, and how our quotations work."
      />
      <LegalDocument
        updated="11 November 2026"
        intro={`The terms on which ${settings.companyName} makes this website available, written in plain language rather than in the usual fog.`}
        sections={sections}
        footer={
          <>
            Our{' '}
            <Link className="text-[var(--brand)] underline" href="/privacy">
              privacy policy
            </Link>{' '}
            explains what we do with your information. Anything unclear, write to{' '}
            <a className="text-[var(--brand)] underline" href={`mailto:${settings.primaryEmail}`}>
              {settings.primaryEmail}
            </a>
            .
          </>
        }
      />
    </>
  );
}
