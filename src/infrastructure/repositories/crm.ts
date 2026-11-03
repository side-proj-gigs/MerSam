import { and, count, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { NotFoundError } from '@core/errors';
import type { Client, Job, JobWithRelations, Lead } from '@core/entities';
import type { ClientRepository, JobRepository, LeadRepository } from '@app-layer/ports';
import type { Database } from '../db/client';
import { clients, jobs, leads, services } from '../db/schema';
import { jsonArray, likeTerm, orderBy, page, pagination, toDate, toDateString } from './helpers';

type LeadRow = typeof leads.$inferSelect;
type JobRow = typeof jobs.$inferSelect;

function mapLead(row: LeadRow): Lead {
  const { dedupeHash: _dedupeHash, ...rest } = row;
  return rest;
}

function mapJob(row: JobRow): Job {
  return {
    ...row,
    startedOn: toDate(row.startedOn),
    completedOn: toDate(row.completedOn),
    photoUrls: jsonArray<string>(row.photoUrls),
  };
}

/** Stable short hash used only to spot a form submitted twice in a row. */
export function dedupeHashFor(phone: string, message: string): string {
  const basis = `${phone.trim()}|${message.trim().toLowerCase().replace(/\s+/g, ' ')}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < basis.length; i += 1) {
    hash ^= basis.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function createLeadRepository(db: Database): LeadRepository {
  return {
    async list(filters) {
      const { pageSize, offset } = pagination(filters);
      const conditions = [
        filters.status ? eq(leads.status, filters.status) : undefined,
        filters.serviceId ? eq(leads.serviceId, filters.serviceId) : undefined,
        filters.assignedTo ? eq(leads.assignedTo, filters.assignedTo) : undefined,
        filters.from ? gte(leads.createdAt, filters.from) : undefined,
        filters.to ? lte(leads.createdAt, filters.to) : undefined,
        filters.search
          ? or(
              ilike(leads.fullName, likeTerm(filters.search)),
              ilike(leads.phone, likeTerm(filters.search)),
              ilike(leads.reference, likeTerm(filters.search)),
              ilike(leads.message, likeTerm(filters.search)),
            )
          : undefined,
      ].filter(Boolean);
      const where = conditions.length ? and(...conditions) : undefined;

      const [rows, [totals]] = await Promise.all([
        db
          .select()
          .from(leads)
          .where(where)
          .orderBy(orderBy(filters, { createdAt: leads.createdAt, fullName: leads.fullName }, desc(leads.createdAt)))
          .limit(pageSize)
          .offset(offset),
        db.select({ value: count() }).from(leads).where(where),
      ]);
      return page(rows.map(mapLead), totals?.value ?? 0, filters);
    },

    async findById(id) {
      const [row] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
      return row ? mapLead(row) : null;
    },

    async findByReference(reference) {
      const [row] = await db.select().from(leads).where(eq(leads.reference, reference)).limit(1);
      return row ? mapLead(row) : null;
    },

    async create(data) {
      const [row] = await db
        .insert(leads)
        .values({ ...data, dedupeHash: dedupeHashFor(data.phone, data.message) })
        .returning();
      return mapLead(row!);
    },

    async update(id, data) {
      const [row] = await db
        .update(leads)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(leads.id, id))
        .returning();
      if (!row) throw new NotFoundError('Lead', id);
      return mapLead(row);
    },

    async delete(id) {
      await db.delete(leads).where(eq(leads.id, id));
    },

    async countByStatus() {
      const rows = await db
        .select({ status: leads.status, value: count() })
        .from(leads)
        .groupBy(leads.status);
      return Object.fromEntries(rows.map((row) => [row.status, row.value]));
    },

    async nextSequence(year) {
      const [row] = await db
        .select({ value: count() })
        .from(leads)
        .where(sql`extract(year from ${leads.createdAt}) = ${year}`);
      return (row?.value ?? 0) + 1;
    },

    async findRecentDuplicate(phone, message, withinMinutes) {
      const since = new Date(Date.now() - withinMinutes * 60 * 1000);
      const [row] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.dedupeHash, dedupeHashFor(phone, message)), gte(leads.createdAt, since)))
        .orderBy(desc(leads.createdAt))
        .limit(1);
      return row ? mapLead(row) : null;
    },
  };
}

export function createClientRepository(db: Database): ClientRepository {
  return {
    async list(filters) {
      const { pageSize, offset } = pagination(filters);
      const conditions = [
        filters.isActive !== undefined ? eq(clients.isActive, filters.isActive) : undefined,
        filters.search
          ? or(
              ilike(clients.name, likeTerm(filters.search)),
              ilike(clients.phone, likeTerm(filters.search)),
              ilike(clients.reference, likeTerm(filters.search)),
            )
          : undefined,
      ].filter(Boolean);
      const where = conditions.length ? and(...conditions) : undefined;

      const [rows, [totals]] = await Promise.all([
        db
          .select()
          .from(clients)
          .where(where)
          .orderBy(orderBy(filters, { name: clients.name, createdAt: clients.createdAt }, desc(clients.createdAt)))
          .limit(pageSize)
          .offset(offset),
        db.select({ value: count() }).from(clients).where(where),
      ]);
      return page(rows as Client[], totals?.value ?? 0, filters);
    },

    async findById(id) {
      const [row] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
      return row ?? null;
    },

    async findByPhone(phone) {
      const [row] = await db.select().from(clients).where(eq(clients.phone, phone)).limit(1);
      return row ?? null;
    },

    async create(data) {
      const [row] = await db.insert(clients).values(data).returning();
      return row!;
    },

    async update(id, data) {
      const [row] = await db
        .update(clients)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(clients.id, id))
        .returning();
      if (!row) throw new NotFoundError('Client', id);
      return row;
    },

    async delete(id) {
      await db.delete(clients).where(eq(clients.id, id));
    },

    async nextSequence() {
      const [row] = await db.select({ value: count() }).from(clients);
      return (row?.value ?? 0) + 1;
    },
  };
}

export function createJobRepository(db: Database): JobRepository {
  const baseSelect = () =>
    db
      .select({ job: jobs, clientName: clients.name, serviceName: services.name })
      .from(jobs)
      .innerJoin(clients, eq(jobs.clientId, clients.id))
      .leftJoin(services, eq(jobs.serviceId, services.id));

  const expand = (row: {
    job: JobRow;
    clientName: string;
    serviceName: string | null;
  }): JobWithRelations => ({
    ...mapJob(row.job),
    clientName: row.clientName,
    serviceName: row.serviceName,
  });

  return {
    async list(filters) {
      const { pageSize, offset } = pagination(filters);
      const conditions = [
        filters.status ? eq(jobs.status, filters.status) : undefined,
        filters.clientId ? eq(jobs.clientId, filters.clientId) : undefined,
        filters.serviceId ? eq(jobs.serviceId, filters.serviceId) : undefined,
        filters.assignedTo ? eq(jobs.assignedTo, filters.assignedTo) : undefined,
        filters.from ? gte(jobs.createdAt, filters.from) : undefined,
        filters.to ? lte(jobs.createdAt, filters.to) : undefined,
        filters.search
          ? or(
              ilike(jobs.title, likeTerm(filters.search)),
              ilike(jobs.reference, likeTerm(filters.search)),
              ilike(clients.name, likeTerm(filters.search)),
            )
          : undefined,
      ].filter(Boolean);
      const where = conditions.length ? and(...conditions) : undefined;

      const [rows, [totals]] = await Promise.all([
        baseSelect()
          .where(where)
          .orderBy(orderBy(filters, { createdAt: jobs.createdAt, title: jobs.title }, desc(jobs.createdAt)))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ value: count() })
          .from(jobs)
          .innerJoin(clients, eq(jobs.clientId, clients.id))
          .where(where),
      ]);
      return page(rows.map(expand), totals?.value ?? 0, filters);
    },

    async findById(id) {
      const [row] = await baseSelect().where(eq(jobs.id, id)).limit(1);
      return row ? expand(row) : null;
    },

    async create(data) {
      const [row] = await db
        .insert(jobs)
        .values({
          ...data,
          startedOn: toDateString(data.startedOn),
          completedOn: toDateString(data.completedOn),
        })
        .returning();
      return mapJob(row!);
    },

    async update(id, data) {
      const { startedOn, completedOn, ...rest } = data;
      const [row] = await db
        .update(jobs)
        .set({
          ...rest,
          ...(startedOn !== undefined ? { startedOn: toDateString(startedOn) } : {}),
          ...(completedOn !== undefined ? { completedOn: toDateString(completedOn) } : {}),
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, id))
        .returning();
      if (!row) throw new NotFoundError('Job', id);
      return mapJob(row);
    },

    async delete(id) {
      await db.delete(jobs).where(eq(jobs.id, id));
    },

    async countByStatus() {
      const rows = await db.select({ status: jobs.status, value: count() }).from(jobs).groupBy(jobs.status);
      return Object.fromEntries(rows.map((row) => [row.status, row.value]));
    },

    async nextSequence(year) {
      const [row] = await db
        .select({ value: count() })
        .from(jobs)
        .where(sql`extract(year from ${jobs.createdAt}) = ${year}`);
      return (row?.value ?? 0) + 1;
    },
  };
}
