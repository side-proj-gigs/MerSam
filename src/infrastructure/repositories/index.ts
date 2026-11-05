import type { Repositories, UnitOfWork } from '@app-layer/ports';
import { db, type Database } from '../db/client';
import { createAuditLogRepository, createUserRepository } from './access';
import {
  createFaqRepository,
  createMediaRepository,
  createProjectRepository,
  createServiceCategoryRepository,
  createServiceRepository,
  createSettingsRepository,
  createTestimonialRepository,
} from './content';
import { createClientRepository, createJobRepository, createLeadRepository } from './crm';
import { createEmailLogRepository, createProposalRepository } from './proposals';
import {
  createInvoiceRepository,
  createPaymentRepository,
  createWorkReportRepository,
} from './finance';

/**
 * Every repository is a factory over a Database handle, so the same code serves
 * both the ambient connection and a transaction scope without any branching.
 */
export function createRepositories(handle: Database): Repositories {
  return {
    services: createServiceRepository(handle),
    serviceCategories: createServiceCategoryRepository(handle),
    testimonials: createTestimonialRepository(handle),
    projects: createProjectRepository(handle),
    faqs: createFaqRepository(handle),
    media: createMediaRepository(handle),
    settings: createSettingsRepository(handle),
    leads: createLeadRepository(handle),
    clients: createClientRepository(handle),
    jobs: createJobRepository(handle),
    invoices: createInvoiceRepository(handle),
    payments: createPaymentRepository(handle),
    workReports: createWorkReportRepository(handle),
    users: createUserRepository(handle),
    audit: createAuditLogRepository(handle),
    proposals: createProposalRepository(handle),
    emailLog: createEmailLogRepository(handle),
  };
}

export function createUnitOfWork(handle: Database = db): UnitOfWork {
  return {
    run: (work) => handle.transaction((tx) => work(createRepositories(tx as unknown as Database))),
  };
}

export { createAuditLogRepository, createUserRepository };
