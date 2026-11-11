'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import type { SiteSettings } from '@core/entities';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Textarea } from '@/components/ui/field';
import { Badge, Card, CardHeader } from '@/components/ui/primitives';
import { LoadingPanel } from '@/components/ui/water-loader';
import { PageHeader } from '@/components/admin/shell';
import { ImageField } from '@/components/admin/image-field';
import { useEmailStatus } from '@/components/admin/send-email-dialog';

type Tab = 'company' | 'contact' | 'hero' | 'documents' | 'email' | 'seo';

const TABS: { value: Tab; label: string }[] = [
  { value: 'company', label: 'Company' },
  { value: 'contact', label: 'Contact' },
  { value: 'hero', label: 'Home page' },
  { value: 'documents', label: 'Invoices and reports' },
  { value: 'email', label: 'Email' },
  { value: 'seo', label: 'Search' },
];

/** Multi-line text fields are edited as lines and stored as arrays. */
const linesToArray = (value: string) =>
  value.split('\n').map((line) => line.trim()).filter(Boolean);

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('company');
  const [draft, setDraft] = useState<Partial<SiteSettings> | null>(null);
  const [addressLines, setAddressLines] = useState('');
  const [keywords, setKeywords] = useState('');

  const { data, isPending } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<SiteSettings>('/api/admin/settings'),
  });

  // Seed the form once, then leave it alone so typing is never overwritten.
  useEffect(() => {
    if (!data || draft) return;
    setDraft(data);
    setAddressLines(data.addressLines.join('\n'));
    setKeywords(data.seoKeywords.join('\n'));
  }, [data, draft]);

  const save = useMutation({
    mutationFn: () =>
      api.patch<SiteSettings>('/api/admin/settings', {
        ...draft,
        addressLines: linesToArray(addressLines),
        seoKeywords: linesToArray(keywords),
      }),
    onSuccess: (saved) => {
      toast.success('Settings saved', { description: 'The website updates within five minutes.' });
      queryClient.setQueryData(['settings'], saved);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isPending || !draft) {
    return <LoadingPanel message="Loading settings" />;
  }

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const text = (key: keyof SiteSettings) => (draft[key] as string | null) ?? '';

  return (
    <>
      <PageHeader
        title="Settings"
        description="Everything the website and the documents read from: contact details, the home page and the defaults stamped onto invoices."
        action={
          <Button
            variant="gold"
            loading={save.isPending}
            onClick={() => save.mutate()}
            leadingIcon={<Save className="size-4" aria-hidden />}
          >
            Save changes
          </Button>
        }
      />

      <div
        className="mb-5 flex flex-wrap gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1"
        role="tablist"
      >
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              tab === item.value
                ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'company' && (
        <Card>
          <CardHeader title="Company" description="Used in the header, the footer and every document" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Input
              label="Trading name"
              value={text('companyName')}
              onChange={(e) => set('companyName', e.target.value)}
            />
            <Input
              label="Legal name"
              value={text('legalName')}
              onChange={(e) => set('legalName', e.target.value)}
            />
            <Input
              label="Tagline"
              wrapperClassName="sm:col-span-2"
              value={text('tagline')}
              onChange={(e) => set('tagline', e.target.value)}
            />
            <Textarea
              label="About"
              wrapperClassName="sm:col-span-2"
              rows={6}
              value={text('about')}
              onChange={(e) => set('about', e.target.value)}
              hint="Separate paragraphs with a blank line"
            />
            <Textarea
              label="Mission"
              wrapperClassName="sm:col-span-2"
              rows={3}
              value={text('mission')}
              onChange={(e) => set('mission', e.target.value)}
            />
            <Input
              label="Logo URL"
              value={text('logoUrl')}
              onChange={(e) => set('logoUrl', e.target.value)}
            />
          </div>
        </Card>
      )}

      {tab === 'contact' && (
        <Card>
          <CardHeader title="Contact" description="Every number and address shown on the website" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Input
              label="Primary phone"
              value={text('primaryPhone')}
              onChange={(e) => set('primaryPhone', e.target.value)}
            />
            <Input
              label="Secondary phone"
              value={text('secondaryPhone')}
              onChange={(e) => set('secondaryPhone', e.target.value)}
            />
            <Input
              label="WhatsApp number"
              value={text('whatsappNumber')}
              onChange={(e) => set('whatsappNumber', e.target.value)}
            />
            <Input
              label="Primary email"
              type="email"
              value={text('primaryEmail')}
              onChange={(e) => set('primaryEmail', e.target.value)}
            />
            <Input
              label="Support email"
              type="email"
              value={text('supportEmail')}
              onChange={(e) => set('supportEmail', e.target.value)}
            />
            <Input label="City" value={text('city')} onChange={(e) => set('city', e.target.value)} />
            <Input
              label="Region"
              value={text('region')}
              onChange={(e) => set('region', e.target.value)}
            />
            <Input
              label="Country"
              value={text('country')}
              onChange={(e) => set('country', e.target.value)}
            />
            <Textarea
              label="Address"
              wrapperClassName="sm:col-span-2"
              rows={3}
              value={addressLines}
              onChange={(e) => setAddressLines(e.target.value)}
              hint="One line per line of the address"
            />
            <Input
              label="Map embed URL"
              wrapperClassName="sm:col-span-2"
              value={text('mapEmbedUrl')}
              onChange={(e) => set('mapEmbedUrl', e.target.value)}
              hint="The src from a Google Maps embed"
            />
          </div>
        </Card>
      )}

      {tab === 'hero' && (
        <Card>
          <CardHeader title="Home page" description="The banner and the emergency strip" />
          <div className="grid gap-4 p-5">
            <Checkbox
              label="Show the emergency banner"
              description="A gold strip above the header on every page"
              checked={draft.emergencyBannerEnabled ?? false}
              onChange={(e) => set('emergencyBannerEnabled', e.target.checked)}
            />
            <Textarea
              label="Emergency banner text"
              rows={2}
              value={text('emergencyBannerText')}
              onChange={(e) => set('emergencyBannerText', e.target.value)}
            />

            <p className="mt-2 rounded-xl bg-[var(--surface-sunken)] p-4 text-sm text-[var(--text-secondary)]">
              The hero slides and the headline figures are seeded with sensible defaults. They are
              stored as structured data, so ask a developer to adjust them, or edit them directly in
              the database.
            </p>
          </div>
        </Card>
      )}

      {tab === 'documents' && (
        <Card>
          <CardHeader
            title="Invoices and reports"
            description="Stamped onto every new invoice and completion report"
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Input
              label="Default VAT rate (%)"
              value={String(draft.defaultVatRate ?? 0)}
              onChange={(e) => set('defaultVatRate', Number(e.target.value) || 0)}
              inputMode="decimal"
            />
            <Input
              label="Default currency"
              value={text('defaultCurrency')}
              onChange={(e) => set('defaultCurrency', e.target.value)}
            />
            <Textarea
              label="Terms of sale"
              wrapperClassName="sm:col-span-2"
              rows={5}
              value={text('defaultInvoiceTerms')}
              onChange={(e) => set('defaultInvoiceTerms', e.target.value)}
              hint="One term per line"
            />
            <Textarea
              label="Payment details"
              wrapperClassName="sm:col-span-2"
              rows={4}
              value={text('defaultPaymentDetails')}
              onChange={(e) => set('defaultPaymentDetails', e.target.value)}
              hint="Shown in the payment box on every invoice"
            />
            <Input
              label="Bank name"
              value={text('bankName')}
              onChange={(e) => set('bankName', e.target.value)}
            />
            <Input
              label="Account name"
              value={text('bankAccountName')}
              onChange={(e) => set('bankAccountName', e.target.value)}
            />
            <Input
              label="Account number"
              value={text('bankAccountNumber')}
              onChange={(e) => set('bankAccountNumber', e.target.value)}
            />
            <Input
              label="Mobile money number"
              value={text('momoNumber')}
              onChange={(e) => set('momoNumber', e.target.value)}
            />
          </div>
        </Card>
      )}

      {tab === 'email' && (
        <EmailSettings
          draft={draft}
          set={set}
          text={text}
        />
      )}

      {tab === 'seo' && (
        <Card>
          <CardHeader title="Search" description="How the site appears in results and when shared" />
          <div className="grid gap-4 p-5">
            <Input
              label="Title"
              value={text('seoTitle')}
              onChange={(e) => set('seoTitle', e.target.value)}
              hint="Around 60 characters reads best in results"
              aside={
                <span className="text-xs tabular-nums text-[var(--text-muted)]">
                  {text('seoTitle').length}
                </span>
              }
            />
            <Textarea
              label="Description"
              rows={3}
              value={text('seoDescription')}
              onChange={(e) => set('seoDescription', e.target.value)}
              hint="Around 155 characters"
              aside={
                <span className="text-xs tabular-nums text-[var(--text-muted)]">
                  {text('seoDescription').length}
                </span>
              }
            />
            <Textarea
              label="Keywords"
              rows={6}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              hint="One per line"
            />
            <ImageField
              label="Share image"
              value={text('ogImageUrl')}
              onChange={(next) => set('ogImageUrl', next)}
              hint="Shown when a link to the site is posted"
            />
          </div>
        </Card>
      )}
    </>
  );
}

/**
 * The email tab is the only settings panel that reports on something outside
 * the database. The provider key is an environment variable, so the form can
 * be filled in perfectly and sending can still be impossible. Saying which of
 * the two is missing, and letting someone prove it with a real message, saves
 * a long hunt later.
 */
function EmailSettings({
  draft,
  set,
  text,
}: {
  draft: Partial<SiteSettings>;
  set: <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => void;
  text: (key: keyof SiteSettings) => string;
}) {
  const status = useEmailStatus();
  const [testTo, setTestTo] = useState('');

  const sendTest = useMutation({
    mutationFn: () =>
      api.post<{ status: string; recipient: string; reason: string | null }>(
        '/api/admin/email/test',
        { to: testTo.trim() },
        { idempotent: false },
      ),
    onSuccess: (outcome) => {
      if (outcome.status === 'sent') {
        toast.success(`Test message sent to ${outcome.recipient}`, {
          description: 'If it does not arrive, check the spam folder and the sending domain.',
        });
        return;
      }
      toast.error(outcome.reason ?? 'Nothing was sent', { duration: 8000 });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const provider = status.data;
  const ready = Boolean(provider?.enabled && provider?.configured);
  const validTest = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(testTo.trim());

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title="Provider"
          description={
            provider?.provider === 'gmail'
              ? 'A Gmail account delivers the messages, authorised once through Google. The credentials are read from the environment, never stored here.'
              : 'Resend delivers the messages. Its API key is read from the environment, never stored here.'
          }
          action={
            provider ? (
              <Badge tone={ready ? 'success' : 'warning'}>{ready ? 'Ready' : 'Not sending'}</Badge>
            ) : undefined
          }
        />
        <div className="p-5">
          <div
            className={cn(
              'flex gap-3 rounded-xl border p-4 text-sm',
              ready
                ? 'border-[color-mix(in_srgb,var(--color-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)]'
                : 'border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)]',
            )}
          >
            {ready ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" aria-hidden />
            )}
            <div>
              <p className="font-semibold text-[var(--text-primary)]">
                {ready
                  ? `Messages go out from ${provider?.from} through ${
                      provider?.provider === 'gmail' ? 'Gmail' : 'Resend'
                    }`
                  : !provider?.enabled
                    ? 'Sending is switched off'
                    : 'No provider is configured'}
              </p>
              <p className="mt-0.5 text-[var(--text-secondary)]">
                {ready
                  ? 'Invoices, work reports, proposals and enquiry confirmations will all be delivered.'
                  : !provider?.enabled
                    ? 'Tick the box below and save. Everything else keeps working in the meantime, documents simply have to be downloaded and sent by hand.'
                    : (provider?.reason ??
                      'Set RESEND_API_KEY and EMAIL_FROM in the environment, then restart the app.')}
              </p>
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                {provider?.provider === 'gmail'
                  ? 'Gmail sends from the mailbox that granted consent, whatever the address below says, and Google applies its own daily limit.'
                  : 'The sending domain has to be verified with Resend before anything will deliver.'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Sender" description="How your messages appear in a client inbox" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Checkbox
            label="Send email from the dashboard"
            description="Turn this off to stop every outbound message at once without touching the configuration."
            className="sm:col-span-2"
            checked={draft.emailEnabled ?? false}
            onChange={(e) => set('emailEnabled', e.target.checked)}
          />
          <Input
            label="From name"
            value={text('emailFromName')}
            onChange={(e) => set('emailFromName', e.target.value)}
            placeholder="MerSam Water Engineering"
          />
          <Input
            label="From address"
            type="email"
            value={text('emailFromAddress')}
            onChange={(e) => set('emailFromAddress', e.target.value)}
            placeholder="accounts@mersam.com"
            hint="Must be on a domain verified with Resend"
          />
          <Input
            label="Reply to"
            type="email"
            value={text('emailReplyTo')}
            onChange={(e) => set('emailReplyTo', e.target.value)}
            hint="Where a client reply should land"
          />
          <Input
            label="Blind copy"
            type="email"
            value={text('emailBcc')}
            onChange={(e) => set('emailBcc', e.target.value)}
            hint="Keeps an office copy of everything sent"
          />
          <Textarea
            label="Signature"
            wrapperClassName="sm:col-span-2"
            rows={4}
            value={text('emailSignature')}
            onChange={(e) => set('emailSignature', e.target.value)}
            hint="Closes every message. One line per line."
          />
          <Checkbox
            label="Confirm every website enquiry"
            description="The person who filled in the contact form gets their reference number straight away, and the office is alerted."
            className="sm:col-span-2"
            checked={draft.sendEnquiryConfirmation ?? true}
            onChange={(e) => set('sendEnquiryConfirmation', e.target.checked)}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Send a test"
          description="Save your changes first, then prove the whole path with a real message"
        />
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
          <Input
            label="Send to"
            wrapperClassName="flex-1"
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@example.com"
          />
          <Button
            variant="secondary"
            loading={sendTest.isPending}
            disabled={!validTest}
            onClick={() => sendTest.mutate()}
            leadingIcon={<Send className="size-4" aria-hidden />}
          >
            Send test
          </Button>
        </div>
      </Card>
    </div>
  );
}
