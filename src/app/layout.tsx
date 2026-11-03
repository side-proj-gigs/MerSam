import type { Metadata, Viewport } from 'next';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import Script from 'next/script';
import { Suspense } from 'react';
import { Toaster } from 'sonner';
import { env } from '@infra/config/env';
import { QueryProvider } from '@/components/providers/query-provider';
import { Preloader } from '@/components/ui/preloader';
import { RouteProgress } from '@/components/ui/route-progress';
import './globals.css';

const display = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  weight: ['400', '500', '600', '700'],
});

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: 'MerSam | Borehole Drilling, Water Treatment and Plumbing in Ghana',
    template: '%s | MerSam',
  },
  description:
    'MerSam delivers borehole drilling, geophysical water surveys, reverse osmosis treatment, solar water heater installation and full plumbing services across Accra and Ghana.',
  applicationName: 'MerSam',
  authors: [{ name: 'MerSam' }],
  openGraph: {
    type: 'website',
    siteName: 'MerSam',
    locale: 'en_GH',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  icons: { icon: '/brand/mersam-icon.png', apple: '/brand/mersam-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0e13' },
  ],
};

/**
 * Applies the stored theme before the first paint. Without this the page
 * renders in the system theme for a frame and then snaps, which is the flash
 * every theme toggle has to design around.
 *
 * It goes through next/script with the beforeInteractive strategy rather than
 * a bare script element: React only executes a script it renders during the
 * server pass, so an inline tag warns in development and would quietly stop
 * working if this layout ever re-rendered on the client.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('mersam-theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Script id="mersam-theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-200 focus:rounded-lg focus:bg-[var(--surface-raised)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-[var(--shadow-float)]"
        >
          Skip to content
        </a>
        {/* useSearchParams needs a boundary so the rest can stay static. */}
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        <Preloader />
        <QueryProvider>{children}</QueryProvider>
        <Toaster
          position="bottom-right"
          closeButton
          richColors
          toastOptions={{ style: { fontFamily: 'var(--font-jakarta)' } }}
        />
      </body>
    </html>
  );
}
