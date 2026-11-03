'use client';

import { useId, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '@/lib/utils';

/**
 * Invoiced against collected, month by month. The gap between the two lines is
 * the whole point of the chart, so both are plotted on one axis in the same
 * unit. A second y-axis would make that gap meaningless.
 *
 * Both colours were checked with the palette validator against the light and
 * dark chart surfaces: every check passes in both modes, including protan and
 * tritan separation.
 */
const SERIES = [
  { key: 'invoiced', label: 'Invoiced', colour: '#ab8420' },
  { key: 'collected', label: 'Collected', colour: '#1e9cb3' },
] as const;

export interface TrendPoint {
  month: string;
  totalMinor: number;
  paidMinor: number;
}

function monthLabel(month: string): string {
  const [year, index] = month.split('-');
  const date = new Date(Number(year), Number(index) - 1, 1);
  return date.toLocaleDateString('en-GB', { month: 'short' });
}

function compact(minorUnits: number): string {
  const major = minorUnits / 100;
  if (major >= 1_000_000) return `${(major / 1_000_000).toFixed(1)}M`;
  if (major >= 1_000) return `${Math.round(major / 1000)}k`;
  return String(Math.round(major));
}

interface TooltipPayload {
  active?: boolean;
  payload?: { payload: { month: string; invoiced: number; collected: number } }[];
}

function ChartTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  const point = payload[0]!.payload;

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 shadow-[var(--shadow-float)]">
      <p className="mb-1.5 text-xs font-semibold text-[var(--text-primary)]">
        {new Date(`${point.month}-01`).toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
        })}
      </p>
      {SERIES.map((series) => (
        <p key={series.key} className="flex items-center gap-2 text-xs">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: series.colour }}
            aria-hidden
          />
          <span className="text-[var(--text-secondary)]">{series.label}</span>
          <span className="ml-auto font-semibold tabular-nums text-[var(--text-primary)]">
            {formatMoney(point[series.key])}
          </span>
        </p>
      ))}
    </div>
  );
}

export function RevenueChart({ trend }: { trend: TrendPoint[] }) {
  const gradientId = useId();
  const [showTable, setShowTable] = useState(false);

  const data = trend.map((point) => ({
    month: point.month,
    label: monthLabel(point.month),
    invoiced: point.totalMinor,
    collected: point.paidMinor,
  }));

  if (data.length === 0) {
    return (
      <p className="grid h-64 place-items-center text-sm text-[var(--text-muted)]">
        No invoices have been raised yet, so there is nothing to chart.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {/* Identity is never carried by colour alone. */}
        <ul className="flex flex-wrap items-center gap-4">
          {SERIES.map((series) => (
            <li key={series.key} className="flex items-center gap-1.5 text-xs font-medium">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: series.colour }}
                aria-hidden
              />
              <span className="text-[var(--text-secondary)]">{series.label}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setShowTable((current) => !current)}
          className="text-xs font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
          aria-expanded={showTable}
        >
          {showTable ? 'Show chart' : 'Show the numbers'}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Invoiced and collected by month</caption>
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left">
                <th scope="col" className="py-2 pr-4 text-xs font-semibold text-[var(--text-muted)]">
                  Month
                </th>
                <th scope="col" className="py-2 pr-4 text-right text-xs font-semibold text-[var(--text-muted)]">
                  Invoiced
                </th>
                <th scope="col" className="py-2 text-right text-xs font-semibold text-[var(--text-muted)]">
                  Collected
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.month} className="border-b border-[var(--border-subtle)]">
                  <th scope="row" className="py-2 pr-4 text-left font-medium">
                    {new Date(`${point.month}-01`).toLocaleDateString('en-GB', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </th>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(point.invoiced)}</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(point.collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -12 }}>
              <defs>
                {SERIES.map((series) => (
                  <linearGradient
                    key={series.key}
                    id={`${gradientId}-${series.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={series.colour} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={series.colour} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-subtle)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                dy={6}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickFormatter={compact}
                width={52}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
              />

              {SERIES.map((series) => (
                <Area
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.colour}
                  strokeWidth={2}
                  fill={`url(#${gradientId}-${series.key})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-raised)' }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
