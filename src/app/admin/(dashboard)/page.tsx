import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  FileText,
  Inbox,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { dashboardDeps } from '@infra/deps';
import { getDashboardMetrics } from '@app-layer/use-cases/dashboard';
import { currentPrincipal } from '@/presentation/http/session';
import { cn, formatMoney, formatRelative, pluralise } from '@/lib/utils';
import { Card, CardHeader, EmptyState } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/admin/shell';
import { RevenueChart } from '@/components/admin/revenue-chart';

export const dynamic = 'force-dynamic';

/** A single headline figure, which is the right form for one number. */
function StatTile({
  label,
  value,
  caption,
  Icon,
  change,
  href,
}: {
  label: string;
  value: string;
  caption?: string;
  Icon: typeof Wallet;
  change?: number;
  href?: string;
}) {
  const rising = (change ?? 0) >= 0;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
          {label}
        </p>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-sunken)] text-[var(--brand)]">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>

      <p className="mt-3 font-display text-2xl font-semibold tabular-nums text-[var(--text-primary)] sm:text-[1.75rem]">
        {value}
      </p>

      <div className="mt-1 flex items-center gap-2">
        {change !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-semibold',
              rising ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]',
            )}
          >
            {rising ? (
              <ArrowUpRight className="size-3.5" aria-hidden />
            ) : (
              <ArrowDownRight className="size-3.5" aria-hidden />
            )}
            {Math.abs(change)}%
          </span>
        )}
        {caption && <span className="text-xs text-[var(--text-muted)]">{caption}</span>}
      </div>
    </>
  );

  return (
    <Card className="p-4 transition-shadow hover:shadow-[var(--shadow-float)]">
      {href ? (
        <Link href={href} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}

function StatusBreakdown({
  title,
  counts,
  total,
  href,
}: {
  title: string;
  counts: Record<string, number>;
  total: number;
  href: string;
}) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <Card>
      <CardHeader
        title={title}
        description={pluralise(total, 'record')}
        action={
          <Link href={href} className="text-xs font-semibold text-[var(--accent)] hover:underline">
            View all
          </Link>
        }
      />
      <div className="p-4">
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">Nothing recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map(([status, count]) => {
              const share = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <li key={status}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-sm capitalize text-[var(--text-secondary)]">
                      {status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                      {count}
                      <span className="ml-1.5 text-xs font-normal text-[var(--text-muted)]">
                        {share}%
                      </span>
                    </span>
                  </div>
                  {/* A proportion bar, anchored at zero, with rounded data-ends. */}
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                    <div
                      className="h-full rounded-full bg-[var(--brand)]"
                      style={{ width: `${Math.max(share, 2)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

export default async function DashboardPage() {
  const principal = await currentPrincipal();
  const metrics = await getDashboardMetrics(dashboardDeps(), principal!);
  const firstName = principal!.name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={`Good day, ${firstName}`}
        description="Everything happening across enquiries, jobs and the books."
        action={
          <div className="flex gap-2">
            <ButtonLink href="/admin/invoices/new" variant="gold" size="sm">
              New invoice
            </ButtonLink>
            <ButtonLink href="/admin/reports/new" variant="outline" size="sm">
              New report
            </ButtonLink>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Invoiced this month"
          value={formatMoney(metrics.revenue.thisMonthMinor)}
          Icon={TrendingUp}
          change={metrics.revenue.changePercent}
          caption="against last month"
        />
        <StatTile
          label="Collected this month"
          value={formatMoney(metrics.revenue.collectedThisMonthMinor)}
          Icon={Wallet}
          caption={pluralise(metrics.revenue.invoiceCount, 'invoice')}
        />
        <StatTile
          label="Outstanding"
          value={formatMoney(metrics.revenue.outstandingMinor)}
          Icon={Receipt}
          caption="across unpaid invoices"
          href="/admin/invoices?status=overdue"
        />
        <StatTile
          label="New enquiries"
          value={String(metrics.leads.newCount)}
          Icon={Inbox}
          caption={`${metrics.leads.total} in total`}
          href="/admin/enquiries?status=new"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Invoiced against collected"
            description="The last twelve months, excluding void invoices"
          />
          <div className="p-4">
            <RevenueChart trend={metrics.trend} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent activity" description="The last dozen changes" />
          <div className="max-h-[22rem] overflow-y-auto">
            {metrics.activity.length === 0 ? (
              <EmptyState title="Nothing yet" description="Activity will appear here as the team works." />
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {metrics.activity.map((entry) => (
                  <li key={entry.id} className="px-4 py-3">
                    <p className="text-sm leading-snug text-[var(--text-primary)]">{entry.summary}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {formatRelative(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <StatusBreakdown
          title="Enquiries by status"
          counts={metrics.leads.byStatus}
          total={metrics.leads.total}
          href="/admin/enquiries"
        />
        <StatusBreakdown
          title="Jobs by status"
          counts={metrics.jobs.byStatus}
          total={metrics.jobs.total}
          href="/admin/jobs"
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {[
          { href: '/admin/enquiries', label: 'Work the enquiry list', Icon: Inbox },
          { href: '/admin/jobs', label: 'Schedule and track jobs', Icon: Briefcase },
          { href: '/admin/reports', label: 'Issue a completion report', Icon: FileText },
        ].map((shortcut) => (
          <Link
            key={shortcut.href}
            href={shortcut.href}
            className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3.5 text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-[var(--surface-sunken)] text-[var(--brand)]">
              <shortcut.Icon className="size-4" aria-hidden />
            </span>
            {shortcut.label}
          </Link>
        ))}
      </div>
    </>
  );
}
