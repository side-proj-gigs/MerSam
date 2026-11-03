import type { SessionPrincipal } from '@core/entities';
import type {
  AuditEntry,
  AuditLogRepository,
  Clock,
  InvoiceRepository,
  JobRepository,
  LeadRepository,
} from '../ports';
import { requireRole } from './auth';

export interface DashboardDeps {
  invoices: InvoiceRepository;
  leads: LeadRepository;
  jobs: JobRepository;
  audit: AuditLogRepository;
  clock: Clock;
}

export interface DashboardMetrics {
  revenue: {
    thisMonthMinor: number;
    lastMonthMinor: number;
    collectedThisMonthMinor: number;
    changePercent: number;
    outstandingMinor: number;
    invoiceCount: number;
  };
  leads: { total: number; byStatus: Record<string, number>; newCount: number };
  jobs: { total: number; byStatus: Record<string, number>; activeCount: number };
  trend: { month: string; totalMinor: number; paidMinor: number }[];
  activity: AuditEntry[];
}

function startOfMonth(reference: Date, monthsBack = 0): Date {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - monthsBack, 1));
}

function endOfMonth(reference: Date, monthsBack = 0): Date {
  return new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - monthsBack + 1, 0, 23, 59, 59),
  );
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getDashboardMetrics(
  deps: DashboardDeps,
  actor: SessionPrincipal,
): Promise<DashboardMetrics> {
  requireRole(actor, 'staff');
  const now = deps.clock.now();

  // Every figure on the dashboard is one query, fired together.
  const [thisMonth, lastMonth, outstanding, trend, leadCounts, jobCounts, activity] =
    await Promise.all([
      deps.invoices.revenueBetween(startOfMonth(now), endOfMonth(now)),
      deps.invoices.revenueBetween(startOfMonth(now, 1), endOfMonth(now, 1)),
      deps.invoices.outstandingTotal(),
      deps.invoices.monthlyRevenue(12),
      deps.leads.countByStatus(),
      deps.jobs.countByStatus(),
      deps.audit.recent(12),
    ]);

  const leadTotal = Object.values(leadCounts).reduce((sum, value) => sum + value, 0);
  const jobTotal = Object.values(jobCounts).reduce((sum, value) => sum + value, 0);

  return {
    revenue: {
      thisMonthMinor: thisMonth.totalMinor,
      lastMonthMinor: lastMonth.totalMinor,
      collectedThisMonthMinor: thisMonth.paidMinor,
      changePercent: percentChange(thisMonth.totalMinor, lastMonth.totalMinor),
      outstandingMinor: outstanding,
      invoiceCount: thisMonth.count,
    },
    leads: { total: leadTotal, byStatus: leadCounts, newCount: leadCounts.new ?? 0 },
    jobs: {
      total: jobTotal,
      byStatus: jobCounts,
      activeCount: (jobCounts.scheduled ?? 0) + (jobCounts.in_progress ?? 0),
    },
    trend,
    activity,
  };
}
