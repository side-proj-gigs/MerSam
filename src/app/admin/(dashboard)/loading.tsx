import { WaterDroplet } from '@/components/ui/water-loader';
import { Skeleton } from '@/components/ui/primitives';

export default function AdminLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <WaterDroplet size="sm" label="Loading the dashboard" />
        <Skeleton className="h-8 w-56" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-7 w-32" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3" aria-hidden>
        <Skeleton className="h-80 rounded-[var(--radius-card)] lg:col-span-2" />
        <Skeleton className="h-80 rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}
