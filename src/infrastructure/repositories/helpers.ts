import { asc, desc, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { buildPage, type Page } from '@core/entities';
import type { ListQuery } from '@app-layer/ports';

/** node-postgres hands back `date` columns as 'YYYY-MM-DD' strings. */
export function toDate(value: string | Date | null): Date | null {
  if (value === null) return null;
  if (value instanceof Date) return value;
  // Anchored at UTC noon so a timezone shift can never roll the day over.
  return new Date(`${value}T12:00:00.000Z`);
}

export function toDateOrThrow(value: string | Date): Date {
  const parsed = toDate(value);
  if (!parsed) throw new Error('Expected a date value but received null');
  return parsed;
}

/** Postgres `date` columns are written back as plain 'YYYY-MM-DD'. */
export function toDateString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

/** `numeric` columns arrive as strings to preserve precision. */
export function toNumber(value: string | number | null, fallback = 0): number {
  if (value === null) return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function jsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

const MAX_PAGE_SIZE = 100;

export function pagination(query: ListQuery): { page: number; pageSize: number; offset: number } {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize ?? 20)));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/**
 * Sorting is whitelisted by column name so a query string cannot reach a column
 * the caller was never meant to order by.
 */
export function orderBy(
  query: ListQuery,
  allowed: Record<string, PgColumn>,
  fallback: SQL | PgColumn,
): SQL | PgColumn {
  const column = query.sort ? allowed[query.sort] : undefined;
  if (!column) return fallback;
  return query.direction === 'asc' ? asc(column) : desc(column);
}

export function page<T>(items: T[], total: number, query: ListQuery): Page<T> {
  const { page: current, pageSize } = pagination(query);
  return buildPage(items, total, current, pageSize);
}

/** Escapes the wildcards so a search for "100%" does not match everything. */
export function likeTerm(search: string): string {
  return `%${search.trim().replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}
