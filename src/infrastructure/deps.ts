import 'server-only';
import type { AuthDeps } from '@app-layer/use-cases/auth';
import type { ContentDeps } from '@app-layer/use-cases/content';
import type { DashboardDeps } from '@app-layer/use-cases/dashboard';
import type { InvoiceDeps } from '@app-layer/use-cases/invoices';
import type { LeadDeps } from '@app-layer/use-cases/leads';
import type { StaffCardDeps } from '@app-layer/use-cases/staff-cards';
import type { WorkReportDeps } from '@app-layer/use-cases/work-reports';
import { env } from './config/env';
import { getContainer } from './container';

/**
 * Each use case asks for exactly the ports it needs. These builders assemble
 * those bundles from the container, so a route handler never has to know which
 * repositories a particular use case happens to touch.
 */

export function contentDeps(): ContentDeps {
  const { repos, cache, ids } = getContainer();
  return {
    services: repos.services,
    serviceCategories: repos.serviceCategories,
    testimonials: repos.testimonials,
    projects: repos.projects,
    faqs: repos.faqs,
    settings: repos.settings,
    audit: repos.audit,
    cache,
    ids,
  };
}

export function authDeps(): AuthDeps {
  const { repos, hasher, tokens, rateLimiter } = getContainer();
  return {
    users: repos.users,
    audit: repos.audit,
    hasher,
    tokens,
    rateLimiter,
    sessionTtlHours: env.sessionTtlHours,
  };
}

export function leadDeps(): LeadDeps {
  const { repos, notifier, rateLimiter, clock, ids } = getContainer();
  return {
    leads: repos.leads,
    clients: repos.clients,
    services: repos.services,
    audit: repos.audit,
    notifier,
    rateLimiter,
    clock,
    ids,
  };
}

export function invoiceDeps(): InvoiceDeps {
  const { repos, clock, ids } = getContainer();
  return {
    invoices: repos.invoices,
    payments: repos.payments,
    settings: repos.settings,
    audit: repos.audit,
    clock,
    ids,
  };
}

export function workReportDeps(): WorkReportDeps {
  const { repos, clock, ids } = getContainer();
  return {
    workReports: repos.workReports,
    invoices: repos.invoices,
    settings: repos.settings,
    audit: repos.audit,
    clock,
    ids,
  };
}

export function dashboardDeps(): DashboardDeps {
  const { repos, clock } = getContainer();
  return {
    invoices: repos.invoices,
    leads: repos.leads,
    jobs: repos.jobs,
    audit: repos.audit,
    clock,
  };
}

/** Direct repository access, for the thin admin list and detail routes. */
export function repositories() {
  return getContainer().repos;
}

export function staffCardDeps(): StaffCardDeps {
  const { repos } = getContainer();
  return { users: repos.users, settings: repos.settings, audit: repos.audit };
}
