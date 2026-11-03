import { and, asc, count, desc, eq, gte, ilike, lte, or, sql, sum } from 'drizzle-orm';
import { NotFoundError } from '@core/errors';
import {
  derivePaymentState,
  type CurrencyCode,
  type InvoiceLine,
  type InvoiceRecord,
  type Payment,
  type WorkReport,
  type WorkReportCostLine,
} from '@core/entities';
import type {
  InvoiceRepository,
  InvoiceSummary,
  PaymentRepository,
  WorkReportRepository,
} from '@app-layer/ports';
import type { Database } from '../db/client';
import { invoiceLines, invoices, payments, workReportCostLines, workReports } from '../db/schema';
import { jsonArray, likeTerm, orderBy, page, pagination, toDateOrThrow, toDate, toDateString, toNumber } from './helpers';

type InvoiceRow = typeof invoices.$inferSelect;
type InvoiceLineRow = typeof invoiceLines.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;
type WorkReportRow = typeof workReports.$inferSelect;
type CostLineRow = typeof workReportCostLines.$inferSelect;

/* ------------------------------------------------------------- mappers */

function mapLine(row: InvoiceLineRow): InvoiceLine {
  return {
    id: row.id,
    unitOfMeasure: row.unitOfMeasure,
    description: row.description,
    quantity: toNumber(row.quantity, 1),
    unitPriceMinor: row.unitPriceMinor,
    lineTotalMinor: row.lineTotalMinor,
    sortOrder: row.sortOrder,
  };
}

function mapInvoice(row: InvoiceRow, lines: InvoiceLineRow[]): InvoiceRecord {
  return {
    ...row,
    currency: row.currency as CurrencyCode,
    issuedOn: toDateOrThrow(row.issuedOn),
    dueOn: toDate(row.dueOn),
    discountValue: toNumber(row.discountValue),
    vatRate: toNumber(row.vatRate),
    lines: lines.map(mapLine).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

function mapPayment(row: PaymentRow): Payment {
  return { ...row, currency: row.currency as CurrencyCode, paidOn: toDateOrThrow(row.paidOn) };
}

function mapCostLine(row: CostLineRow): WorkReportCostLine {
  return {
    id: row.id,
    description: row.description,
    amountMinor: row.amountMinor,
    sortOrder: row.sortOrder,
  };
}

function mapWorkReport(row: WorkReportRow, costLines: CostLineRow[]): WorkReport {
  return {
    ...row,
    currency: row.currency as CurrencyCode,
    dateOfWork: toDateOrThrow(row.dateOfWork),
    reportDate: toDateOrThrow(row.reportDate),
    photoUrls: jsonArray<string>(row.photoUrls),
    costLines: costLines.map(mapCostLine).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

/* ------------------------------------------------------------- invoices */

export function createInvoiceRepository(db: Database): InvoiceRepository {
  async function loadLines(invoiceId: string): Promise<InvoiceLineRow[]> {
    return db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoiceId))
      .orderBy(asc(invoiceLines.sortOrder));
  }

  async function writeLines(invoiceId: string, lines: InvoiceLine[]): Promise<void> {
    await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId));
    if (lines.length === 0) return;
    await db.insert(invoiceLines).values(
      lines.map((line) => ({
        id: line.id,
        invoiceId,
        unitOfMeasure: line.unitOfMeasure,
        description: line.description,
        quantity: String(line.quantity),
        unitPriceMinor: line.unitPriceMinor,
        lineTotalMinor: line.lineTotalMinor,
        sortOrder: line.sortOrder,
      })),
    );
  }

  return {
    async list(filters) {
      const { pageSize, offset } = pagination(filters);
      const conditions = [
        filters.status ? eq(invoices.status, filters.status) : undefined,
        filters.clientId ? eq(invoices.clientId, filters.clientId) : undefined,
        filters.jobId ? eq(invoices.jobId, filters.jobId) : undefined,
        filters.from ? gte(invoices.issuedOn, toDateString(filters.from)!) : undefined,
        filters.to ? lte(invoices.issuedOn, toDateString(filters.to)!) : undefined,
        filters.search
          ? or(
              ilike(invoices.invoiceNumber, likeTerm(filters.search)),
              ilike(invoices.customerName, likeTerm(filters.search)),
              ilike(invoices.customerReference, likeTerm(filters.search)),
            )
          : undefined,
      ].filter(Boolean);
      const where = conditions.length ? and(...conditions) : undefined;

      const [rows, [totals]] = await Promise.all([
        db
          .select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            customerName: invoices.customerName,
            issuedOn: invoices.issuedOn,
            dueOn: invoices.dueOn,
            status: invoices.status,
            currency: invoices.currency,
            totalMinor: invoices.totalMinor,
            amountPaidMinor: invoices.amountPaidMinor,
            balanceMinor: invoices.balanceMinor,
          })
          .from(invoices)
          .where(where)
          .orderBy(
            orderBy(
              filters,
              { issuedOn: invoices.issuedOn, totalMinor: invoices.totalMinor, customerName: invoices.customerName },
              desc(invoices.issuedOn),
            ),
          )
          .limit(pageSize)
          .offset(offset),
        db.select({ value: count() }).from(invoices).where(where),
      ]);

      const items: InvoiceSummary[] = rows.map((row) => ({
        ...row,
        issuedOn: toDateOrThrow(row.issuedOn),
        dueOn: toDate(row.dueOn),
      }));
      return page(items, totals?.value ?? 0, filters);
    },

    async findById(id) {
      const [row] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
      if (!row) return null;
      return mapInvoice(row, await loadLines(id));
    },

    async findByNumber(invoiceNumber) {
      const [row] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.invoiceNumber, invoiceNumber))
        .limit(1);
      if (!row) return null;
      return mapInvoice(row, await loadLines(row.id));
    },

    async create(data) {
      const { lines, ...header } = data;
      const [row] = await db
        .insert(invoices)
        .values({
          ...header,
          issuedOn: toDateString(header.issuedOn)!,
          dueOn: toDateString(header.dueOn),
          discountValue: String(header.discountValue),
          vatRate: String(header.vatRate),
        })
        .returning();
      await writeLines(row!.id, lines);
      return mapInvoice(row!, await loadLines(row!.id));
    },

    async update(id, data, lines) {
      const { issuedOn, dueOn, discountValue, vatRate, ...rest } = data;
      const [row] = await db
        .update(invoices)
        .set({
          ...rest,
          ...(issuedOn !== undefined ? { issuedOn: toDateString(issuedOn)! } : {}),
          ...(dueOn !== undefined ? { dueOn: toDateString(dueOn) } : {}),
          ...(discountValue !== undefined ? { discountValue: String(discountValue) } : {}),
          ...(vatRate !== undefined ? { vatRate: String(vatRate) } : {}),
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, id))
        .returning();
      if (!row) throw new NotFoundError('Invoice', id);
      if (lines) await writeLines(id, lines);
      return mapInvoice(row, await loadLines(id));
    },

    async delete(id) {
      await db.delete(invoices).where(eq(invoices.id, id));
    },

    async countSameDay(issuedOn) {
      const [row] = await db
        .select({ value: count() })
        .from(invoices)
        .where(eq(invoices.issuedOn, toDateString(issuedOn)!));
      return row?.value ?? 0;
    },

    async refreshPaymentTotals(id) {
      // One statement recomputes paid and balance from the payments table, so
      // the stored columns can never drift away from the ledger.
      const [row] = await db
        .update(invoices)
        .set({
          amountPaidMinor: sql`coalesce((select sum(${payments.amountMinor})::int from ${payments} where ${payments.invoiceId} = ${invoices.id}), 0)`,
          balanceMinor: sql`greatest(${invoices.totalMinor} - coalesce((select sum(${payments.amountMinor})::int from ${payments} where ${payments.invoiceId} = ${invoices.id}), 0), 0)`,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, id))
        .returning();
      if (!row) throw new NotFoundError('Invoice', id);
      return mapInvoice(row, await loadLines(id));
    },

    async revenueBetween(from, to) {
      const [row] = await db
        .select({
          totalMinor: sql<number>`coalesce(sum(${invoices.totalMinor}), 0)::int`,
          paidMinor: sql<number>`coalesce(sum(${invoices.amountPaidMinor}), 0)::int`,
          value: count(),
        })
        .from(invoices)
        .where(
          and(
            gte(invoices.issuedOn, toDateString(from)!),
            lte(invoices.issuedOn, toDateString(to)!),
            sql`${invoices.status} <> 'void'`,
          ),
        );
      return { totalMinor: row?.totalMinor ?? 0, paidMinor: row?.paidMinor ?? 0, count: row?.value ?? 0 };
    },

    async monthlyRevenue(months) {
      const rows = await db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${invoices.issuedOn}), 'YYYY-MM')`,
          totalMinor: sql<number>`coalesce(sum(${invoices.totalMinor}), 0)::int`,
          paidMinor: sql<number>`coalesce(sum(${invoices.amountPaidMinor}), 0)::int`,
        })
        .from(invoices)
        .where(
          and(
            sql`${invoices.issuedOn} >= date_trunc('month', current_date) - make_interval(months => ${months - 1})`,
            sql`${invoices.status} <> 'void'`,
          ),
        )
        .groupBy(sql`date_trunc('month', ${invoices.issuedOn})`)
        .orderBy(sql`date_trunc('month', ${invoices.issuedOn})`);
      return rows;
    },

    async outstandingTotal() {
      const [row] = await db
        .select({ value: sql<number>`coalesce(sum(${invoices.balanceMinor}), 0)::int` })
        .from(invoices)
        .where(sql`${invoices.status} in ('sent', 'partially_paid', 'overdue')`);
      return row?.value ?? 0;
    },
  };
}

/* ------------------------------------------------------------- payments */

export function createPaymentRepository(db: Database): PaymentRepository {
  return {
    async list(filters) {
      const { pageSize, offset } = pagination(filters);
      const conditions = [
        filters.invoiceId ? eq(payments.invoiceId, filters.invoiceId) : undefined,
        filters.clientId ? eq(payments.clientId, filters.clientId) : undefined,
        filters.from ? gte(payments.paidOn, toDateString(filters.from)!) : undefined,
        filters.to ? lte(payments.paidOn, toDateString(filters.to)!) : undefined,
        filters.search ? ilike(payments.reference, likeTerm(filters.search)) : undefined,
      ].filter(Boolean);
      const where = conditions.length ? and(...conditions) : undefined;

      const [rows, [totals]] = await Promise.all([
        db
          .select()
          .from(payments)
          .where(where)
          .orderBy(desc(payments.paidOn), desc(payments.createdAt))
          .limit(pageSize)
          .offset(offset),
        db.select({ value: count() }).from(payments).where(where),
      ]);
      return page(rows.map(mapPayment), totals?.value ?? 0, filters);
    },

    async listForInvoice(invoiceId) {
      const rows = await db
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, invoiceId))
        .orderBy(asc(payments.paidOn));
      return rows.map(mapPayment);
    },

    async findById(id) {
      const [row] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
      return row ? mapPayment(row) : null;
    },

    async create(data) {
      const [row] = await db
        .insert(payments)
        .values({ ...data, paidOn: toDateString(data.paidOn)! })
        .returning();
      return mapPayment(row!);
    },

    async delete(id) {
      await db.delete(payments).where(eq(payments.id, id));
    },

    async totalForInvoice(invoiceId) {
      const [row] = await db
        .select({ value: sum(payments.amountMinor) })
        .from(payments)
        .where(eq(payments.invoiceId, invoiceId));
      return toNumber(row?.value ?? null, 0);
    },
  };
}

/* --------------------------------------------------------- work reports */

export function createWorkReportRepository(db: Database): WorkReportRepository {
  async function loadCostLines(reportId: string): Promise<CostLineRow[]> {
    return db
      .select()
      .from(workReportCostLines)
      .where(eq(workReportCostLines.reportId, reportId))
      .orderBy(asc(workReportCostLines.sortOrder));
  }

  async function writeCostLines(reportId: string, lines: WorkReportCostLine[]): Promise<void> {
    await db.delete(workReportCostLines).where(eq(workReportCostLines.reportId, reportId));
    if (lines.length === 0) return;
    await db.insert(workReportCostLines).values(
      lines.map((line) => ({
        id: line.id,
        reportId,
        description: line.description,
        amountMinor: line.amountMinor,
        sortOrder: line.sortOrder,
      })),
    );
  }

  return {
    async list(filters) {
      const { pageSize, offset } = pagination(filters);
      const conditions = [
        filters.status ? eq(workReports.status, filters.status) : undefined,
        filters.clientId ? eq(workReports.clientId, filters.clientId) : undefined,
        filters.search
          ? or(
              ilike(workReports.reportNumber, likeTerm(filters.search)),
              ilike(workReports.clientName, likeTerm(filters.search)),
            )
          : undefined,
      ].filter(Boolean);
      const where = conditions.length ? and(...conditions) : undefined;

      const [rows, [totals]] = await Promise.all([
        db
          .select()
          .from(workReports)
          .where(where)
          .orderBy(desc(workReports.reportDate), desc(workReports.createdAt))
          .limit(pageSize)
          .offset(offset),
        db.select({ value: count() }).from(workReports).where(where),
      ]);

      // The list view shows totals only, so the cost lines stay unfetched.
      const items = rows.map((row) => mapWorkReport(row, []));
      return page(items, totals?.value ?? 0, filters);
    },

    async findById(id) {
      const [row] = await db.select().from(workReports).where(eq(workReports.id, id)).limit(1);
      if (!row) return null;
      return mapWorkReport(row, await loadCostLines(id));
    },

    async findByNumber(reportNumber) {
      const [row] = await db
        .select()
        .from(workReports)
        .where(eq(workReports.reportNumber, reportNumber))
        .limit(1);
      if (!row) return null;
      return mapWorkReport(row, await loadCostLines(row.id));
    },

    async create(data) {
      const { costLines, ...header } = data;
      const [row] = await db
        .insert(workReports)
        .values({
          ...header,
          dateOfWork: toDateString(header.dateOfWork)!,
          reportDate: toDateString(header.reportDate)!,
          paymentState: derivePaymentState(header.totalCostMinor, header.totalPaidMinor),
        })
        .returning();
      await writeCostLines(row!.id, costLines);
      return mapWorkReport(row!, await loadCostLines(row!.id));
    },

    async update(id, data, costLines) {
      const { dateOfWork, reportDate, ...rest } = data;
      const [row] = await db
        .update(workReports)
        .set({
          ...rest,
          ...(dateOfWork !== undefined ? { dateOfWork: toDateString(dateOfWork)! } : {}),
          ...(reportDate !== undefined ? { reportDate: toDateString(reportDate)! } : {}),
          updatedAt: new Date(),
        })
        .where(eq(workReports.id, id))
        .returning();
      if (!row) throw new NotFoundError('Work report', id);
      if (costLines) await writeCostLines(id, costLines);
      return mapWorkReport(row, await loadCostLines(id));
    },

    async delete(id) {
      await db.delete(workReports).where(eq(workReports.id, id));
    },

    async nextSequence(year) {
      const [row] = await db
        .select({ value: count() })
        .from(workReports)
        .where(sql`extract(year from ${workReports.reportDate}) = ${year}`);
      return (row?.value ?? 0) + 1;
    },
  };
}
