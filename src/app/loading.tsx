import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="py-4 space-y-6" aria-busy="true" aria-live="polite">
      <div className="border-b border-border pb-6">
        <h1 className="font-serif text-3xl font-bold text-ink tracking-tight mb-2">
          Loading Studio...
        </h1>
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>

      <Skeleton className="h-64 w-full" />
    </div>
  );
}
