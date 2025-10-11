import { Skeleton } from "@/components/ui/skeleton";

export default function OpportunityDetailLoading() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-4">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="rounded-lg border p-4">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="rounded-lg border p-4">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="rounded-lg border p-4">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="rounded-lg border p-4 md:col-span-2 lg:col-span-3">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4 mt-2" />
        </div>
      </div>
    </div>
  );
}
