"use client"

import { useState } from "react"
import { ExternalLink, Loader2, MoreHorizontal, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useImport, useImportLimits } from "@/hooks/import/use-import"
import { useWindowDrop } from "@/hooks/import/use-window-drop"
import type { RowFilter } from "@/lib/import/api"
import type { PickedFile } from "@/lib/import/walk"
import type { ImportBatchSummary, ImportRow } from "@/types/import"
import { DropZone } from "./DropZone"
import { ADD_ON_OPEN_LIBRARY_URL, EditionSheet } from "./EditionSheet"
import { RowList } from "./RowList"

const FILTERS = [
  { id: "all", label: "All", filter: {}, count: (s: ImportBatchSummary) => s.total },
  { id: "matched", label: "Matched", filter: { state: "matched" }, count: (s: ImportBatchSummary) => s.counts.matched ?? 0 },
  { id: "needs_review", label: "Needs review", filter: { state: "needs_review" }, count: (s: ImportBatchSummary) => s.counts.needs_review ?? 0 },
  { id: "no_match", label: "No match", filter: { state: "no_match" }, count: (s: ImportBatchSummary) => s.counts.no_match ?? 0 },
  { id: "duplicate", label: "Duplicate", filter: { state: "duplicate" }, count: (s: ImportBatchSummary) => s.counts.duplicate ?? 0 },
  { id: "skipped", label: "Skipped", filter: { skipped: true }, count: (s: ImportBatchSummary) => s.skipped },
  { id: "failed", label: "Failed", filter: { state: "failed" }, count: (s: ImportBatchSummary) => s.counts.failed ?? 0 },
] as const satisfies readonly { id: string; label: string; filter: RowFilter; count: (s: ImportBatchSummary) => number }[]

function Progress({ label, done, total }: { label: string; done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{done} / {total}</span>
      </div>
      <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function ImportTab() {
  const { t } = useTranslation()
  const [filterId, setFilterId] = useState<(typeof FILTERS)[number]["id"]>("all")
  const [q, setQ] = useState("")
  const [editing, setEditing] = useState<ImportRow | null>(null)
  const [addedOnOL, setAddedOnOL] = useState(false)
  const limits = useImportLimits().data

  const filter: RowFilter = { ...FILTERS.find((f) => f.id === filterId)!.filter, ...(q.trim() ? { q: q.trim() } : {}) }
  const imp = useImport(filter)
  const { summary, phase } = imp
  const counts = summary?.counts ?? {}
  const queued = counts.queued ?? 0
  const match = summary?.match
  const noMatch = counts.no_match ?? 0
  const busy = phase.kind !== "idle"
  const importing = phase.kind === "importing"
  const retention = limits?.retention_days ?? 30
  const dragging = useWindowDrop(imp.addFiles, imp.reportError, !busy)

  const pick = (f: PickedFile[]) =>
    f.length ? imp.addFiles(f) : imp.reportError(t("No files found in what you chose. Empty folders and hidden files are skipped."))

  const startImport = async () => {
    const res = await imp.runImport()
    if (res.missing) toast.warning(t("{{n}} books need their file. Drop the folder again to send them.", { n: res.missing }))
    else if (res.failed) toast.error(t("{{n}} books failed. See the Failed filter.", { n: res.failed }))
    else toast.success(t("Import finished."))
  }

  if (imp.loading) return <Skeleton className="h-64 w-full rounded-xl" />

  return (
    <div className="space-y-4">
      {dragging && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm"
        >
          <div className="rounded-2xl border-4 border-dashed border-primary px-12 py-16 text-center text-2xl font-semibold">
            {t("Drop to add EPUBs")}
          </div>
        </div>
      )}
      {imp.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{imp.error}</p>
      )}

      <DropZone onPick={pick} onChooseFolder={imp.folderSupported ? imp.chooseFolder : undefined} compact={!!summary} disabled={busy} />

      {phase.kind === "reading" && <Progress label={t("Reading books")} done={phase.done} total={phase.total} />}
      {phase.kind === "saving" && <Progress label={t("Saving the list")} done={phase.done} total={phase.total} />}
      {importing && <Progress label={t("Importing")} done={phase.done} total={phase.total} />}

      {summary && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {t("{{n}} books. This list is kept for {{days}} days after your last change, then cleared.", { n: summary.total, days: retention })}
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" disabled={busy}>{t("Start over")}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("Clear this list?")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("Books already imported stay in the library.")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => imp.clearBatch()}>{t("Clear list")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {match?.status === "failed" ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <p className="mr-auto">
                {t("Matching stopped.")} {match.error}
                {match.retry_after ? ` ${t("Try again in about {{n}} seconds.", { n: Math.ceil(match.retry_after) })}` : ""}
              </p>
              <Button size="sm" onClick={() => imp.recheck("queued")} disabled={busy}>{t("Retry matching")}</Button>
            </div>
          ) : (
            queued > 0 && (
              <Progress
                label={match?.status === "running" ? t("Matched {{done}} of {{total}}", { done: match.done, total: match.total }) : t("Matching with Open Library")}
                done={summary.total - queued - (counts.not_epub ?? 0)}
                total={summary.total - (counts.not_epub ?? 0)}
              />
            )
          )}

          {imp.notice && <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">{t(imp.notice)}</p>}
          {imp.missing > 0 && (
            <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="mr-auto">
                {t("Drop the same folder again to reconnect {{n}} files. Your choices are kept.", { n: imp.missing })}
              </p>
              {imp.folderName && (
                <Button size="sm" onClick={imp.reconnectFolder} disabled={busy}>
                  {t("Reconnect folder")}
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("Filter books")}>
            {FILTERS.map((f) => {
              const n = f.count(summary)
              if (f.id === "failed" && !n) return null
              return (
                <Button key={f.id} size="sm" variant={filterId === f.id ? "default" : "outline"} aria-pressed={filterId === f.id} onClick={() => setFilterId(f.id)}>
                  {t(f.label)} <span className="ml-1 tabular-nums opacity-80">{n}</span>
                </Button>
              )
            })}
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search title or file")} aria-label={t("Search title or file")} className="ml-auto w-full @md:w-64" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" aria-label={t("Actions for these books")}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => imp.bulk("skip")}>{t("Skip these")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => imp.bulk("unskip")}>{t("Unskip these")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => imp.bulk("set_encrypted", true)}>{t("Encrypt these")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => imp.bulk("set_encrypted", false)}>{t("Don't encrypt these")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {imp.rows.length === 0 && !imp.rowsLoading ? (
            <p className="rounded-xl border p-8 text-center text-muted-foreground">{t("Nothing here.")}</p>
          ) : (
            <RowList
              rows={imp.rows}
              hasMore={imp.hasMore}
              loadMore={imp.loadMore}
              needsFile={(r) => !imp.hasFile(r)}
              onOpen={setEditing}
              onToggleSkip={(r) => imp.patchRow(r, { skipped: !r.skipped })}
              onToggleEncrypted={(r) => imp.patchRow(r, { encrypted: !r.encrypted })}
            />
          )}

          <div className="sticky bottom-0 -mx-2 flex flex-wrap items-center gap-2 border-t bg-background/95 px-2 py-3 backdrop-blur">
            <p className="mr-auto text-sm">
              {t("{{n}} ready to import", { n: summary.ready })}
              {(counts.needs_review ?? 0) + noMatch > 0 && (
                <span className="text-muted-foreground"> · {t("{{n}} need you", { n: (counts.needs_review ?? 0) + noMatch })}</span>
              )}
            </p>
            {noMatch > 0 && (
              <>
                <Button variant="outline" asChild onClick={() => setAddedOnOL(true)}>
                  <a href={ADD_ON_OPEN_LIBRARY_URL} target="_blank" rel="noopener noreferrer">
                    {t("Add on Open Library")}
                    <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
                  </a>
                </Button>
                <Button variant={addedOnOL ? "default" : "outline"} onClick={() => { setAddedOnOL(false); imp.recheck("no_match") }}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("Re-check {{n}} unmatched", { n: noMatch })}
                </Button>
              </>
            )}
            {importing ? (
              <Button variant="outline" onClick={imp.cancelImport}>{t("Stop after current books")}</Button>
            ) : (
              <Button disabled={busy || summary.ready === 0} onClick={startImport}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("Import {{n}} books", { n: summary.ready })}
              </Button>
            )}
          </div>

          <EditionSheet batchId={imp.batchId!} row={editing} onClose={() => setEditing(null)} onPick={(r, olid) => imp.patchRow(r, { olid })} />
        </>
      )}
    </div>
  )
}
