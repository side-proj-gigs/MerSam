import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/presentation/http/session';
import { AdminShell } from '@/components/admin/shell';

export const metadata: Metadata = {
  title: { default: 'Dashboard', template: '%s | MerSam Admin' },
  robots: { index: false, follow: false },
};

// The admin reflects live data, so nothing here is cached between requests.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Middleware already turned away anyone without a valid signature. This is
  // the authoritative check: it confirms the account still exists and is active.
  const principal = await currentPrincipal();
  if (!principal) redirect('/admin/login');

  return <AdminShell principal={principal}>{children}</AdminShell>;
}
