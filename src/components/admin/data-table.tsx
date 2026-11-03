'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import type { Page } from '@core/entities';
import { api, query as buildQuery } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks';
import { Input } from '@/components/ui/field';
import { Card, EmptyState, Pagination, Skeleton } from '@/components/ui/primitives';
import { WaterDots } from '@/components/ui/water-loader';

export interface Column<T> {
  key: string;
  header: string;
  /** Hides the column below the given breakpoint, keeping phones readable. */
  hideBelow?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  /** Used as the React Query cache key and as the endpoint. */
  endpoint: string;
  queryKey: string;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  filters?: Record<string, string | undefined>;
  toolbar?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
}

const HIDE_CLASSES = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
} as const;

/**
 * The one table behind every admin list. Search is debounced so a query runs
 * when typing stops rather than on each keystroke, the previous page stays on
 * screen while the next one loads so the layout never collapses, and the whole
 * result is cached by React Query so moving back to a list is instant.
 */
export function DataTable<T>({
  endpoint,
  queryKey,
  columns,
  rowKey,
  onRowClick,
  searchPlaceholder = 'Search',
  filters = {},
  toolbar,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  pageSize = 20,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 350);

  // A new search starts at the first page; staying on page 7 would show nothing.
  const filterSignature = JSON.stringify(filters);
  useEffect(() => setPage(1), [debouncedSearch, filterSignature]);

  const url = useMemo(
    () => `${endpoint}${buildQuery({ page, pageSize, search: debouncedSearch, ...filters })}`,
    [endpoint, page, pageSize, debouncedSearch, filterSignature],
  );

  const { data, isPending, isFetching, isError, error } = useQuery({
    queryKey: [queryKey, page, pageSize, debouncedSearch, filterSignature],
    queryFn: () => api.get<Page<T>>(url),
    placeholderData: keepPreviousData,
  });

  const rows = data?.items ?? [];

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            leadingIcon={<Search className="size-4" aria-hidden />}
            aria-label={searchPlaceholder}
            className="pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Clear search"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* A quiet indicator for a background refetch, so the table does not
              flash back to skeletons on every keystroke. */}
          {isFetching && !isPending && <WaterDots label="Refreshing" />}
          {toolbar}
        </div>
      </div>

      {isError ? (
        <EmptyState
          title="Could not load this list"
          description={error instanceof Error ? error.message : 'Please try again shortly'}
        />
      ) : isPending ? (
        <div className="flex flex-col gap-3 p-4" aria-busy>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-11" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      'whitespace-nowrap px-4 py-2.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]',
                      column.align === 'right' && 'text-right',
                      column.hideBelow && HIDE_CLASSES[column.hideBelow],
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-[var(--surface-sunken)]',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-4 py-3 align-middle',
                        column.align === 'right' && 'text-right',
                        column.hideBelow && HIDE_CLASSES[column.hideBelow],
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > 0 && (
        <div className="border-t border-[var(--border-subtle)] px-4">
          <Pagination
            page={data.page}
            pageCount={data.pageCount}
            total={data.total}
            onChange={setPage}
          />
        </div>
      )}
    </Card>
  );
}

/** A row of mutually exclusive filter chips, kept in the page's own state. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  allLabel = 'All',
}: {
  options: { value: T; label: string; count?: number }[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  allLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
      <button
        type="button"
        onClick={() => onChange(undefined)}
        aria-pressed={value === undefined}
        className={cn(
          'rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
          value === undefined
            ? 'border-transparent bg-[var(--text-primary)] text-[var(--text-inverse)]'
            : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
        )}
      >
        {allLabel}
      </button>

      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
            value === option.value
              ? 'border-transparent bg-[var(--text-primary)] text-[var(--text-inverse)]'
              : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="ml-1.5 opacity-60">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
