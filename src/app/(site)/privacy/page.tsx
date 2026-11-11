import type { Metadata } from 'next';
import Link from 'next/link';
import { getSiteSettings } from '@app-layer/use-cases/content';
import { contentDeps } from '@infra/deps';
import { PageBanner } from '@/components/site/page-banner';
import { LegalDocument, type LegalSection } from '@/components/site/legal-document';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'What personal information this website collects, why it is collected, how long it is kept and how to have it removed.',
};

/**
 * Written against what the application actually does, not from a template.
 *
 * Every claim here is checkable in the code: the enquiry form fields come
 * from the lead entity, the cookie name and lifetime from the session
 * module, the retained IP address from the rate limiter, and the Google
 * section from the Gmail sender. If any of those change, this changes.
 *
 * The Google section is not optional dressing. An app that sends through a
 * Gmail account has to disclose how it accesses, uses, stores and shares
 * Google user data, and Google checks that the policy says so before it will
 * verify the app.
 */
export default async function PrivacyPage() {
  const settings = await getSiteSettings(contentDeps());
  const company = settings.legalName || settings.companyName;
  const address = [...settings.addressLines, settings.city, settings.country]
    .filter(Boolean)
    .join(', ');

  const sections: LegalSection[] = [
    {
      heading: 'Who we are',
      body: [
        `${company} provides water engineering and plumbing services in ${settings.country}. This policy covers ${settings.companyName}'s website and the office system behind it.`,
        `We decide why and how the information described here is handled, which makes us the data controller for it. If you want anything on this page explained, or you want us to act on one of the rights set out below, write to ${settings.primaryEmail} or call ${settings.primaryPhone}.`,
        address ? `Our address is ${address}.` : null,
      ],
    },
    {
      heading: 'What we collect, and why',
      body: [
        'We do not ask for anything we do not need in order to quote for work and carry it out.',
      ],
      list: [
        {
          term: 'When you use the quote form',
          detail:
            'Your name, phone number, the area you are in and your message. An email address and an indication of budget only if you choose to give them, and the service you selected. We use this to call you back and to prepare a quotation. It is the only reason we ask.',
        },
        {
          term: 'When you become a client',
          detail:
            'Contact details and site address, plus the records of the work itself: quotations, invoices, payments received and completion reports. We keep these because they are the record of a transaction, and because tax law requires us to.',
        },
        {
          term: 'Automatically, on every visit',
          detail:
            'Your IP address is recorded briefly so the same address cannot flood the contact form or guess at staff passwords. It is kept with a timestamp and nothing else, and it is deleted once the limiting window has passed. We do not run advertising or analytics trackers, and we do not build a profile of you.',
        },
      ],
    },
    {
      heading: 'Cookies and what is stored in your browser',
      body: [
        'This site sets no advertising cookies and shares nothing with ad networks.',
      ],
      list: [
        {
          term: 'mersam_session',
          detail:
            'A cookie set only for staff signing in to the office dashboard. It holds a signed token, cannot be read by scripts in the page, and expires automatically. Visitors to the public site are never given one.',
        },
        {
          term: 'Stored in your browser, never sent to us',
          detail:
            'Whether you chose the light or dark theme, whether you have seen the opening animation this session, and a draft of the contact form so a closed tab does not lose a long message. All of it stays on your device and you can clear it at any time through your browser settings.',
        },
      ],
    },
    {
      heading: 'Email, and how Google user data is used',
      body: [
        'When you submit the quote form we send you a confirmation carrying your reference number, and we alert our own office. Clients also receive invoices, quotations and completion reports by email.',
        `Messages are delivered either through Resend, a transactional email provider, or through a ${settings.companyName} Google account using the Gmail API. Which one is in use depends on how the system is configured at the time.`,
        'Where the Gmail API is used, the application is authorised to send mail from that single company mailbox and nothing more. It holds the one permission needed to send a message, and it has no ability to read, search, delete or modify any email in that mailbox, or to reach any other part of the Google account.',
        'The information that leaves us in those messages is the content of the message itself: your name, your reference number, and the quotation, invoice or report being sent. We do not read Google user data, we do not store it beyond the log described below, we do not transfer it to anyone else, and we never use it for advertising, for profiling, or to train any model. Use of information received from Google APIs follows the Google API Services User Data Policy, including its Limited Use requirements.',
        'We keep a log of messages sent: who it went to, the subject line, whether it succeeded and when. That log exists so we can answer the question "did our invoice reach you", and it holds no message body.',
      ],
    },
    {
      heading: 'Where your information is held',
      body: [
        'The website runs on Vercel and the database is hosted by Neon, both on servers in the United States. Uploaded photographs are stored in the same database.',
        'That means information about you is transferred outside Ghana. We rely on the contractual protections those providers offer, and we have chosen providers that encrypt data in transit and at rest.',
        'Connections to this site are encrypted. Staff passwords are stored only as irreversible hashes, never as the password itself, so nobody at this company can read yours.',
      ],
    },
    {
      heading: 'Who else sees it',
      body: ['We do not sell information about you. We never have and we do not intend to.'],
      list: [
        {
          term: 'Our own staff',
          detail:
            'Only those who need it to answer your enquiry or carry out the work. Access to the office dashboard is limited by role and every sign in is recorded.',
        },
        {
          term: 'The providers that run the system',
          detail:
            'Vercel for hosting, Neon for the database, and Resend or Google for delivering email. They process information on our instructions in order to provide those services, and for no purpose of their own.',
        },
        {
          term: 'Where the law requires it',
          detail:
            'If we are obliged to disclose something by law or by a court, we will. We will tell you unless we are forbidden from doing so.',
        },
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        'An enquiry that does not become a job is kept for two years, so that we recognise you if you come back to us, and is then deleted.',
        'Records of work actually carried out, meaning quotations, invoices, payments and completion reports, are kept for six years after the work finishes. That is an accounting and tax obligation rather than a choice.',
        'The IP addresses used for rate limiting are deleted within hours. The email log is kept for two years.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'You can ask us for a copy of what we hold about you, ask us to correct something that is wrong, or ask us to delete it. You can also object to how we are using it, or ask us to restrict that use while a question is resolved.',
        `Write to ${settings.primaryEmail} and we will respond within 30 days. We will not charge you and we will not ask you to explain why.`,
        'Some requests we cannot fully grant: we cannot delete an invoice we are legally required to keep. Where that happens we will say so and tell you exactly what is being retained and why.',
        'If you are not satisfied with how we have handled a request, you can complain to the Data Protection Commission of Ghana.',
      ],
    },
    {
      heading: 'Children',
      body: [
        'This site is for people arranging building and plumbing work. It is not aimed at children and we do not knowingly collect information about them. If you believe a child has sent us their details, tell us and we will remove them.',
      ],
    },
    {
      heading: 'Changes to this policy',
      body: [
        'If we change what we collect or what we do with it, we will update this page and change the date at the top. Material changes will be mentioned on the home page as well, rather than made quietly.',
      ],
    },
  ];

  return (
    <>
      <PageBanner
        eyebrow="Legal"
        title="Privacy policy"
        description="What we collect, why we collect it, and how to have it removed."
      />
      <LegalDocument
        updated="11 November 2026"
        intro={`This explains what ${settings.companyName} does with personal information collected through this website and the office system behind it. It is written to be read, not to be skimmed past.`}
        sections={sections}
        footer={
          <>
            Questions about any of this go to{' '}
            <a className="text-[var(--brand)] underline" href={`mailto:${settings.primaryEmail}`}>
              {settings.primaryEmail}
            </a>
            . Our <Link className="text-[var(--brand)] underline" href="/terms">terms of service</Link>{' '}
            cover the use of this website itself.
          </>
        }
      />
    </>
  );
}
