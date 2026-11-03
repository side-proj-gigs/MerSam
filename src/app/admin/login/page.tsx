import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { img, BLUR_DATA_URL } from '@/lib/media';
import { LoginForm } from '@/components/admin/login-form';

export const metadata: Metadata = {
  title: 'Staff sign in',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to the website
          </Link>

          <Image
            src="/brand/mersam-mark.png"
            alt="MerSam"
            width={132}
            height={103}
            priority
            className="mt-10 h-auto w-28"
          />

          <h1 className="mt-7 font-display text-3xl font-semibold text-[var(--text-primary)]">
            Staff sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            The office dashboard for enquiries, jobs, invoices and reports.
          </p>

          <Suspense fallback={<div className="mt-8 h-64" />}>
            <LoginForm />
          </Suspense>

          <p className="mt-8 flex items-start gap-2 text-xs text-[var(--text-muted)]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            Sessions are signed, stored in a secure cookie and expire automatically. Repeated failed
            attempts are rate limited.
          </p>
        </div>
      </div>

      <div className="relative hidden lg:block">
        <Image
          src={img('waterSurface', { width: 1400 })}
          alt=""
          fill
          sizes="50vw"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-ink-950/55" aria-hidden />
        <div
          className="absolute inset-0 opacity-50"
          style={{ background: 'radial-gradient(ellipse at 30% 70%, #c9a22766 0%, transparent 60%)' }}
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="font-display text-3xl font-semibold leading-tight text-white">
            Clean water, engineered properly, from the borehole to the tap.
          </p>
          <p className="mt-3 text-sm text-ink-300">MerSam Water Systems and Plumbing Services</p>
        </div>
      </div>
    </div>
  );
}
