import { LoadingPanel } from '@/components/ui/water-loader';
import { Skeleton } from '@/components/ui/primitives';

/** Streamed in while a public page's data is still being fetched. */
export default function SiteLoading() {
  return (
    <div className="container-page py-24">
      <LoadingPanel message="Drawing the page" hint="One moment while we fetch the latest" />

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)]"
          >
            <Skeleton className="aspect-[16/10] rounded-none" />
            <div className="flex flex-col gap-2 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
