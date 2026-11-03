import type { Metadata } from 'next';
import { contentDeps } from '@infra/deps';
import { listActiveServices, getSiteSettings } from '@app-layer/use-cases/content';
import { SiteFooter } from '@/components/site/footer';
import { SiteHeader } from '@/components/site/header';
import { QuickContact } from '@/components/site/quick-contact';
import { ScrollProgressBar } from '@/components/ui/motion';

/** Public pages are statically rendered and revalidated, not rebuilt per hit. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings(contentDeps());

  return {
    title: { default: settings.seoTitle, template: `%s | ${settings.companyName}` },
    description: settings.seoDescription,
    keywords: settings.seoKeywords,
    openGraph: {
      title: settings.seoTitle,
      description: settings.seoDescription,
      images: settings.ogImageUrl ? [{ url: settings.ogImageUrl }] : undefined,
    },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const deps = contentDeps();
  const [settings, services] = await Promise.all([getSiteSettings(deps), listActiveServices(deps)]);

  return (
    <>
      <ScrollProgressBar />
      <SiteHeader settings={settings} services={services} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter settings={settings} services={services} />
      <QuickContact phone={settings.primaryPhone} whatsapp={settings.whatsappNumber} />
    </>
  );
}
