import UploadForm from "@/components/UploadForm"
import { Suspense } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"

function UploadFormSkeleton() {
  return (
    <div className="flex flex-col h-full space-y-10 p-2 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-[480px] max-w-full" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Left: Queue Table */}
        <div className="xl:col-span-2 space-y-6">
          {/* Table header bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-48 rounded-lg" />
              <Skeleton className="h-9 w-36 rounded-lg" />
            </div>
          </div>
          {/* Table rows */}
          <div className="rounded-xl border overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 flex gap-4">
              <Skeleton className="h-3 w-4" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24 ml-auto" />
              <Skeleton className="h-3 w-24" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-4 flex items-center gap-4 border-t">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-[42px] w-[29px] rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-8 w-28 rounded-lg" />
                <Skeleton className="h-5 w-5 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Settings panel */}
        <div className="space-y-6">
          <div className="rounded-xl border p-6 space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <div className="pt-2 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-3 w-40" />
                </div>
              ))}
            </div>
            <Skeleton className="h-10 w-full rounded-lg mt-4" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<UploadFormSkeleton />}>
      <UploadForm />
    </Suspense>
  )
}
