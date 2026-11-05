import { and, asc, count, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { NotFoundError } from '@core/errors';
import type {
  CurrencyCode,
  EmailLogEntry,
  Proposal,
  ProposalItem,
} from '@core/entities';
import type {
  EmailLogRepository,
  ProposalRepository,
  ProposalSummary,
} from '@app-layer/ports';
import type { Database } from '../db/client';
import { emailLog, proposalItems, proposals } from '../db/schema';
import { likeTerm, orderBy, page, pagination, toDate, toDateOrThrow, toDateString, toNumber } from './helpers';

type ProposalRow = typeof proposals.$inferSelect;
type ItemRow = typeof proposalItems.$inferSelect;

function mapItem(row: ItemRow): ProposalItem {
  return {
    id: row.id,
    section: row.section,
    title: row.title,
    description: row.description,
    unitOfMeasure: row.unitOfMeasure,
    quantity: toNumber(row.quantity, 1),
    unitPriceMinor: row.unitPriceMinor,
    isOptional: row.isOptional,
    sortOrder: row.sortOrder,
    lineTotalMinor: row.lineTotalMinor,
  };
}

function mapProposal(row: ProposalRow, items: ItemRow[]): Proposal {
  return {
    ...row,
    currency: row.currency as CurrencyCode,
    issuedOn: toDateOrThrow(row.issuedOn),
    validUntil: toDate(row.validUntil),
    discountValue: toNumber(row.discountValue),
    vatRate: toNumber(row.vatRate),
    items: items.map(mapItem).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export function createProposalRepository(db: Database): ProposalRepository {
  async function loadItems(proposalId: string): Promise<ItemRow[]> {
    return db
      .select()
      .from(proposalItems)
      .where(eq(proposalItems.proposalId, proposalId))
      .orderBy(asc(proposalItems.sortOrder));
  }

  async function writeItems(proposalId: string, items: ProposalItem[]): Promise<void> {
    await db.delete(proposalItems).where(eq(proposalItems.proposalId, proposalId));
    if (items.length === 0) return;
    await db.insert(proposalItems).values(
      items.map((item) => ({
        id: item.id,
        proposalId,
        section: item.section,
        title: item.title,
        description: item.description,
        unitOfMeasure: item.unitOfMeasure,
        quantity: String(item.quantity),
        unitPriceMinor: item.unitPriceMinor,
        lineTotalMinor: item.lineTotalMinor,
        isOptional: item.isOptional,
        sortOrder: item.sortOrder,
      })),
    );
  }

  return {
    async list(filters) {
      const { pageSize, offset } = pagination(filters);
      const conditions = [
        filters.status ? eq(proposals.status, filters.status) : undefined,
        filters.clientId ? eq(proposals.clientId, filters.clientId) : undefined,
        filters.from ? gte(proposals.issuedOn, toDateString(filters.from)!) : undefined,
        filters.to ? lte(proposals.issuedOn, toDateString(filters.to)!) : undefined,
        filters.search
          ? or(
              ilike(proposals.proposalNumber, likeTerm(filters.search)),
              ilike(proposals.clientName, likeTerm(filters.search)),
              ilike(proposals.title, likeTerm(filters.search)),
            )
          : undefined,
      ].filter(Boolean);
      const where = conditions.length ? and(...conditions) : undefined;

      const [rows, [totals]] = await Promise.all([
        db
          .select({
            id: proposals.id,
            proposalNumber: proposals.proposalNumber,
            clientName: proposals.clientName,
            title: proposals.title,
            issuedOn: proposals.issuedOn,
            validUntil: proposals.validUntil,
            status: proposals.status,
            currency: proposals.currency,
            totalMinor: proposals.totalMinor,
            clientEmail: proposals.clientEmail,
          })
          .from(proposals)
          .where(where)
          .orderBy(
            orderBy(
              filters,
              { issuedOn: proposals.issuedOn, totalMinor: proposals.totalMinor, clientName: proposals.clientName },
              desc(proposals.issuedOn),
            ),
          )
          .limit(pageSize)
          .offset(offset),
        db.select({ value: count() }).from(proposals).where(where),
      ]);

      const items: ProposalSummary[] = rows.map((row) => ({
        ...row,
        issuedOn: toDateOrThrow(row.issuedOn),
        validUntil: toDate(row.validUntil),
      }));
      return page(items, totals?.value ?? 0, filters);
    },

    async findById(id) {
      const [row] = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
      if (!row) return null;
      return mapProposal(row, await loadItems(id));
    },

    async findByNumber(proposalNumber) {
      const [row] = await db
        .select()
        .from(proposals)
        .where(eq(proposals.proposalNumber, proposalNumber))
        .limit(1);
      if (!row) return null;
      return mapProposal(row, await loadItems(row.id));
    },

    async create(data) {
      const { items, ...header } = data;
      const [row] = await db
        .insert(proposals)
        .values({
          ...header,
          issuedOn: toDateString(header.issuedOn)!,
          validUntil: toDateString(header.validUntil),
          discountValue: String(header.discountValue),
          vatRate: String(header.vatRate),
        })
        .returning();
      await writeItems(row!.id, items);
      return mapProposal(row!, await loadItems(row!.id));
    },

    async update(id, data, items) {
      const { issuedOn, validUntil, discountValue, vatRate, ...rest } = data;
      const [row] = await db
        .update(proposals)
        .set({
          ...rest,
          ...(issuedOn !== undefined ? { issuedOn: toDateString(issuedOn)! } : {}),
          ...(validUntil !== undefined ? { validUntil: toDateString(validUntil) } : {}),
          ...(discountValue !== undefined ? { discountValue: String(discountValue) } : {}),
          ...(vatRate !== undefined ? { vatRate: String(vatRate) } : {}),
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, id))
        .returning();
      if (!row) throw new NotFoundError('Proposal', id);
      if (items) await writeItems(id, items);
      return mapProposal(row, await loadItems(id));
    },

    async delete(id) {
      await db.delete(proposals).where(eq(proposals.id, id));
    },

    async nextSequence(year) {
      const [row] = await db
        .select({ value: count() })
        .from(proposals)
        .where(sql`extract(year from ${proposals.issuedOn}) = ${year}`);
      return (row?.value ?? 0) + 1;
    },

    async countByStatus() {
      const rows = await db
        .select({ status: proposals.status, value: count() })
        .from(proposals)
        .groupBy(proposals.status);
      return Object.fromEntries(rows.map((row) => [row.status, row.value]));
    },
  };
}

export function createEmailLogRepository(db: Database): EmailLogRepository {
  return {
    async record(entry) {
      // A logging failure must never take down the thing it is describing.
      try {
        await db.insert(emailLog).values({
          kind: entry.kind,
          status: entry.status,
          recipient: entry.recipient.slice(0, 254),
          subject: entry.subject.slice(0, 400),
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          providerId: entry.providerId ?? null,
          error: entry.error ?? null,
          sentBy: entry.sentBy ?? null,
        });
      } catch (error) {
        console.error('Failed to write an email log entry', error);
      }
    },

    async list(filters) {
      const { pageSize, offset } = pagination(filters);
      const conditions = [
        filters.entityType ? eq(emailLog.entityType, filters.entityType) : undefined,
        filters.entityId ? eq(emailLog.entityId, filters.entityId) : undefined,
        filters.search ? ilike(emailLog.recipient, likeTerm(filters.search)) : undefined,
      ].filter(Boolean);
      const where = conditions.length ? and(...conditions) : undefined;

      const [rows, [totals]] = await Promise.all([
        db
          .select()
          .from(emailLog)
          .where(where)
          .orderBy(desc(emailLog.createdAt))
          .limit(pageSize)
          .offset(offset),
        db.select({ value: count() }).from(emailLog).where(where),
      ]);

      return page(rows as EmailLogEntry[], totals?.value ?? 0, filters);
    },

    async lastSuccessFor(entityType, entityId) {
      const [row] = await db
        .select()
        .from(emailLog)
        .where(
          and(
            eq(emailLog.entityType, entityType),
            eq(emailLog.entityId, entityId),
            eq(emailLog.status, 'sent'),
          ),
        )
        .orderBy(desc(emailLog.createdAt))
        .limit(1);
      return (row as EmailLogEntry | undefined) ?? null;
    },
  };
}
