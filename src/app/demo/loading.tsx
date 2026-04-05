import { Skeleton } from '@/components/ui/skeleton';

export default function DemoLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Banner skeleton */}
      <Skeleton className="h-12 w-full rounded-none" />

      {/* Title skeleton */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <Skeleton className="h-4 w-[32rem] max-w-full" />
      </div>

      {/* Input summary card skeleton */}
      <div className="rounded-xl ring-1 ring-foreground/10 p-4 space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* Result view skeleton */}
      <div className="rounded-xl ring-1 ring-foreground/10 p-4 space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>

      {/* Simulator skeleton */}
      <div className="rounded-xl ring-1 ring-foreground/10 p-4 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
