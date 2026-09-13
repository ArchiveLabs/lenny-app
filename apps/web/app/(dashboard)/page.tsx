"use client"

import { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import UploadForm from "@/components/UploadForm"
import ProcessingQueue from "@/components/ProcessingQueue"
import { useUploadJobs } from "@/hooks/use-upload-jobs"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslation } from "react-i18next"

function UploadsPageSkeleton() {
  return (
    <div className="flex flex-col h-full space-y-10 p-2 md:p-6 lg:p-8">
      <div className="flex flex-col space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-[480px] max-w-full" />
      </div>
      <Skeleton className="h-9 w-56 rounded-lg" />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        <div className="xl:col-span-2 space-y-6">
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
        <div className="space-y-6">
          <div className="rounded-xl border p-6 space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-10 w-full rounded-lg mt-4" />
          </div>
        </div>
      </div>
    </div>
  )
}

function UploadsPage() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { stats } = useUploadJobs()

  const tabParam = searchParams?.get("tab") === "processing" ? "processing" : "attach"
  const [tab, setTab] = useState(tabParam)

  const goToTab = (next: "attach" | "processing") => {
    setTab(next)
    router.replace(next === "attach" ? "/" : "/?tab=processing", { scroll: false })
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 space-y-8 p-2 md:p-6 lg:p-8">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{t("Uploads")}</h2>
        <p className="text-muted-foreground text-base max-w-2xl">
          {t("Attach files to queued books, then track their processing status.")}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => goToTab(v as "attach" | "processing")} className="gap-8">
        <TabsList className="w-fit">
          <TabsTrigger value="attach">{t("Attach & Upload")}</TabsTrigger>
          <TabsTrigger value="processing" className="gap-1.5">
            {t("Processing")}
            {stats.active > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {stats.active}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="attach">
          <UploadForm onUploadComplete={() => goToTab("processing")} />
        </TabsContent>
        <TabsContent value="processing">
          <ProcessingQueue onGoToUpload={() => goToTab("attach")} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<UploadsPageSkeleton />}>
      <UploadsPage />
    </Suspense>
  )
}
