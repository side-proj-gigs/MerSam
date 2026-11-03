'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import type { SiteSettings } from '@core/entities';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Textarea } from '@/components/ui/field';
import { Card, CardHeader } from '@/components/ui/primitives';
import { LoadingPanel } from '@/components/ui/water-loader';
import { PageHeader } from '@/components/admin/shell';

type Tab = 'company' | 'contact' | 'hero' | 'documents' | 'seo';

const TABS: { value: Tab; label: string }[] = [
  { value: 'company', label: 'Company' },
  { value: 'contact', label: 'Contact' },
  { value: 'hero', label: 'Home page' },
  { value: 'documents', label: 'Invoices and reports' },
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
            <Input
              label="Share image URL"
              value={text('ogImageUrl')}
              onChange={(e) => set('ogImageUrl', e.target.value)}
              hint="Shown when a link to the site is posted"
            />
          </div>
        </Card>
      )}
    </>
  );
}
