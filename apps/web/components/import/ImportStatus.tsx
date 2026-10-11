"use client"

import Link from "next/link"
import { Info } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"
import { Spinner } from "@workspace/ui/components/spinner"
import { isImportActive, type ImportBatchSummary } from "@/types/import"

const n = (v: number) => v.toLocaleString("en-US")

/**
 * Where the import stands, drawn from the server's batch summary alone, so it reads the same after a reload
 * or in another tab. Nothing is shown before the first import.
 */
export function ImportStatus({
  summary,
  disabled,
  onShowFailed,
  onRetryFailed,
  onStartAgain,
  onViewHistory,
}: {
  summary: ImportBatchSummary
  disabled?: boolean
  onShowFailed: () => void
  onRetryFailed: () => void
  onStartAgain: () => void
  onViewHistory?: () => void
}) {
  const { t } = useTranslation()
  const job = summary.import ?? null
  const rowsImporting = summary.counts.importing ?? 0

  if (isImportActive(job) || (!job && rowsImporting > 0)) {
    // Without a job (after a server restart) the counts are all there is.
    const done = job ? job.done : (summary.counts.imported ?? 0)
    const total = job ? job.total : done + rowsImporting
    return (
      <Alert role="status" className="flex items-start border-blue-200 bg-blue-50 text-blue-900">
        <AlertDescription className="w-full space-y-2 text-inherit">
          <div className="flex items-center justify-between gap-3 font-medium">
            <span className="flex items-center gap-2">
              <Spinner aria-hidden />
              {t("Importing {{done}} of {{total}}", { done: n(done), total: n(total) })}
            </span>
          </div>
          <Progress value={total ? Math.round((done / total) * 100) : 0} aria-label={t("Import progress")} className="bg-blue-100" />
          <p className="flex items-center gap-1.5 text-xs text-blue-800">
            <Info className="h-3.5 w-3.5" aria-hidden />
            {t("You can leave this page. The import continues on the server.")}
          </p>
        </AlertDescription>
      </Alert>
    )
  }

  if (job?.status === "failed") {
    return (
      <Alert role="alert" className="flex items-center border-red-200 bg-red-50 text-red-900">
        <AlertDescription className="flex w-full flex-wrap items-center gap-3 text-inherit">
          <span className="mr-auto">
            {t("The import stopped.")} {job.error}
          </span>
          <Button size="sm" onClick={onStartAgain} disabled={disabled}>{t("Start again")}</Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (job?.status === "done" && job.total > 0) {
    const parts = [t("{{n}} imported.", { n: n(job.imported) })]
    if (job.duplicate > 0) parts.push(t("{{n}} were already in your library.", { n: n(job.duplicate) }))
    if (job.failed > 0) parts.push(t("{{n}} failed.", { n: n(job.failed) }))
    return (
      <Alert role="status" className={`flex items-start ${job.failed > 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-900"}`}>
        <AlertDescription className="w-full space-y-2 text-inherit">
          <div className="flex flex-wrap items-center gap-3">
            <p className="mr-auto font-medium">{parts.join(" ")}</p>
            {job.failed > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={onShowFailed}>{t("Show failed")}</Button>
                <Button size="sm" variant="outline" onClick={onRetryFailed} disabled={disabled}>{t("Retry failed")}</Button>
              </>
            )}
            {onViewHistory && <Button size="sm" variant="outline" onClick={onViewHistory}>{t("View history")}</Button>}
            <Button size="sm" variant="outline" asChild>
              <Link href="/library">{t("View in Library")}</Link>
            </Button>
          </div>
          {job.waiting > 0 && (
            <p className="text-sm">{t("{{n}} books are still waiting for their files. Drop the folder again to finish them.", { n: n(job.waiting) })}</p>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return null
}
