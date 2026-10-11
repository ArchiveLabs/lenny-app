"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Lock, LockOpen, RefreshCw, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Progress as ProgressBar } from "@workspace/ui/components/progress"
import { Spinner } from "@workspace/ui/components/spinner"
import { PAGE_SIZE, useImport, useImportLimits } from "@/hooks/import/use-import"
import { useWindowDrop } from "@/hooks/import/use-window-drop"
import type { RowFilter } from "@/lib/import/api"
import type { PickedFile } from "@/lib/import/walk"
import type { ImportBatchSummary, ImportRow } from "@/types/import"
import { DropZone } from "./DropZone"
import { ImportHistory } from "./ImportHistory"
import { Notice } from "./Notice"
import { ADD_ON_OPEN_LIBRARY_URL, EditionSheet } from "./EditionSheet"
import { ImportStatus } from "./ImportStatus"
import { Pager } from "./Pager"
import { RowDetails } from "./RowDetails"
import { RowList } from "./RowList"

const FILTERS = [
  // Loaded books only: the imported ones live in the History tab.
  { id: "all", label: "All", filter: { exclude_state: "imported" }, count: (s: ImportBatchSummary) => s.total - (s.counts.imported ?? 0) },
  { id: "matched", label: "Matched", filter: { state: "matched" }, count: (s: ImportBatchSummary) => s.counts.matched ?? 0 },
  { id: "needs_review", label: "Needs review", filter: { state: "needs_review" }, count: (s: ImportBatchSummary) => s.counts.needs_review ?? 0 },
  { id: "no_match", label: "No match", filter: { state: "no_match" }, count: (s: ImportBatchSummary) => s.counts.no_match ?? 0 },
  { id: "duplicate", label: "Duplicate", filter: { state: "duplicate" }, count: (s: ImportBatchSummary) => s.counts.duplicate ?? 0 },
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
      <ProgressBar value={pct} aria-label={label} className="bg-muted" />
    </div>
  )
}

export function ImportTab() {
  const { t } = useTranslation()
  const [filterId, setFilterId] = useState<(typeof FILTERS)[number]["id"]>("all")
  const [q, setQ] = useState("")
  const [editing, setEditing] = useState<ImportRow | null>(null)
  const [viewingId, setViewingId] = useState<number | null>(null) // by id, so the panel follows the row as it updates
  const [addedOnOL, setAddedOnOL] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [selected, setSelected] = useState<ReadonlyMap<number, ImportRow>>(new Map())
  const [confirmSelected, setConfirmSelected] = useState(false)
  const [selectAll, setSelectAll] = useState(false) // every book in this view, not only the ones on this page
  const clearSelection = () => {
    setSelected(new Map())
    setSelectAll(false)
  }
  const limits = useImportLimits().data

  const filter: RowFilter = { ...FILTERS.find((f) => f.id === filterId)!.filter, ...(q.trim() ? { q: q.trim() } : {}) }
  const [page, setPage] = useState(0) // 0-based; back to the first page whenever the filter or search changes
  const imp = useImport(filter, page)
  const allEncrypted = imp.rows.length > 0 && imp.rows.every((r) => r.encrypted)
  const anyEncrypted = imp.rows.some((r) => r.encrypted)
  const activeCount = imp.summary ? FILTERS.find((f) => f.id === filterId)!.count(imp.summary) : 0
  // The server's count for this exact filter and search; the chip count is right only without a search.
  const total = imp.total ?? (q.trim() ? undefined : activeCount)
  useEffect(() => {
    // Removing books can leave the current page past the end.
    if (total !== undefined && page > 0 && page * PAGE_SIZE >= total) setPage(Math.max(0, Math.ceil(total / PAGE_SIZE) - 1))
  }, [total, page])
  const select = (row: ImportRow, on: boolean) =>
    setSelected((cur) => {
      const next = new Map(cur)
      if (on) next.set(row.id, row)
      else next.delete(row.id)
      return next
    })
  const selectable = imp.rows.filter((r) => r.state !== "importing")
  const pageSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id))
  const toggleSelectPage = () =>
    setSelected((cur) => {
      const next = new Map(cur)
      for (const r of selectable) pageSelected ? next.delete(r.id) : next.set(r.id, r)
      return next
    })
  // Encrypt flips to "Don't encrypt" once everything selected is already encrypted.
  const encryptOff = selectAll ? allEncrypted : selected.size > 0 && [...selected.values()].every((r) => r.encrypted)
  const toggleEncryptSelection = () =>
    selectAll ? imp.bulk("set_encrypted", !encryptOff) : imp.encryptRows([...selected.values()], !encryptOff)
  const { summary, phase } = imp
  const counts = summary?.counts ?? {}
  const queued = counts.queued ?? 0
  const match = summary?.match
  // An empty batch (nothing added yet, or everything removed) gets the big drop zone, not the list chrome.
  const hasList = !!summary && summary.total > 0
  const importedCount = counts.imported ?? 0
  const loadedCount = summary ? summary.total - importedCount : 0
  const [tab, setTab] = useState<"loaded" | "history">("loaded")
  const noMatch = counts.no_match ?? 0
  const busy = phase.kind !== "idle"
  const retention = limits?.retention_days ?? 30
  const dragging = useWindowDrop(imp.addFiles, imp.reportError, !busy)

  const pick = (f: PickedFile[]) =>
    f.length ? imp.addFiles(f) : imp.reportError(t("No files found in what you chose. Empty folders and hidden files are ignored."))

  // Resuming a batch takes a moment; a grey block that then turns into something else looks like a glitch.
  if (imp.loading) return null

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
      {imp.error && <Notice tone="error">{imp.error}</Notice>}

      <DropZone onPick={pick} onChooseFolder={imp.folderSupported ? imp.chooseFolder : undefined} compact={hasList} disabled={busy} />

      {phase.kind === "reading" && <Progress label={t("Reading books")} done={phase.done} total={phase.total} />}
      {phase.kind === "saving" && <Progress label={t("Saving the list")} done={phase.done} total={phase.total} />}

      {hasList && (
        <>

          {match?.status === "failed" ? (
            <Notice tone="error" action={<Button size="sm" onClick={() => imp.recheck("queued")} disabled={busy}>{t("Retry matching")}</Button>}>
              {t("Matching stopped.")} {match.error}
              {match.retry_after ? ` ${t("Try again in about {{n}} seconds.", { n: Math.ceil(match.retry_after) })}` : ""}
            </Notice>
          ) : (
            queued > 0 && (
              <Progress
                label={match?.status === "running" ? t("Matched {{done}} of {{total}}", { done: match.done, total: match.total }) : t("Matching with Open Library")}
                done={loadedCount - queued - (counts.not_epub ?? 0)}
                total={loadedCount - (counts.not_epub ?? 0)}
              />
            )
          )}

          <ImportStatus
            summary={summary}
            disabled={busy || imp.importing}
            onViewHistory={() => setTab("history")}
            onShowFailed={() => {
              setTab("loaded")
              setFilterId("failed")
              setPage(0)
              clearSelection()
            }}
            onRetryFailed={() => imp.runImport(true)}
            onStartAgain={() => imp.runImport()}
          />

          <Tabs value={tab} onValueChange={(v) => setTab(v as "loaded" | "history")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="loaded">
                {t("Loaded")} <span className="ml-1 tabular-nums opacity-70">{loadedCount}</span>
              </TabsTrigger>
              <TabsTrigger value="history">
                {t("History")} <span className="ml-1 tabular-nums opacity-70">{importedCount}</span>
              </TabsTrigger>
            </TabsList>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" disabled={busy}>{t("Start over")}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("Clear the loaded books?")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {importedCount > 0 ? t("Books already imported stay in the library and in History.") : t("Books already imported stay in the library.")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => (importedCount > 0 ? imp.clearLoaded() : imp.clearBatch())}>{t("Clear loaded books")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            </div>
            <TabsContent value="loaded" className="mt-4 space-y-4">

          {imp.uploading && (
            <div className="space-y-1">
              <Progress label={t("Uploading files")} done={summary.staged} total={summary.staged + summary.unstaged} />
              <p className="text-xs text-muted-foreground">{t("Files are uploaded as books are matched, so you can leave this page.")}</p>
            </div>
          )}
          {imp.uploadFailed > 0 && !imp.uploading && (
            <Notice tone="error" action={<Button size="sm" onClick={imp.retryUploads}>{t("Try again")}</Button>}>
              {t("{{n}} files could not be uploaded.", { n: imp.uploadFailed })}
            </Notice>
          )}

          {imp.notice && <Notice tone="info">{t(imp.notice)}</Notice>}
          {imp.missing > 0 && !imp.reconnecting && (
            <Notice
              tone="warning"
              action={imp.folderName && <Button size="sm" onClick={imp.reconnectFolder} disabled={busy}>{t("Reconnect folder")}</Button>}
            >
              {t("Drop the same folder again to reconnect {{n}} files. Your choices are kept.", { n: imp.missing })}
              {imp.folderName && ` ${t("Chrome can remember this: choose “Allow on every visit” when it asks.")}`}
            </Notice>
          )}

          {summary.skipped > 0 && (
            <Notice tone="info" action={<Button size="sm" variant="outline" onClick={() => imp.bulk("remove", undefined, { skipped: true })}>{t("Remove them")}</Button>}>
              {t("{{n}} books were skipped earlier", { n: summary.skipped })}
            </Notice>
          )}

          <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {q.trim() ? t("Remove the books matching this search from this list?") : t("Remove {{n}} books from this list?", { n: activeCount })}
                </AlertDialogTitle>
                <AlertDialogDescription>{t("They are not imported. Drop the files again to bring them back.")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    imp.bulk("remove")
                    clearSelection()
                  }}
                >
                  {t("Remove")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={confirmSelected} onOpenChange={setConfirmSelected}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("Remove {{n}} selected books from this list?", { n: selected.size })}</AlertDialogTitle>
                <AlertDialogDescription>{t("They are not imported. Drop the files again to bring them back.")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    imp.removeRows([...selected.values()])
                    clearSelection()
                  }}
                >
                  {t("Remove")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("Filter books")}>
            {FILTERS.map((f) => {
              const n = f.count(summary)
              if (!n && f.id !== "all" && f.id !== filterId) return null // a filter with nothing in it is noise
              return (
                <Button key={f.id} size="sm" variant={filterId === f.id ? "default" : "outline"} aria-pressed={filterId === f.id} onClick={() => { setFilterId(f.id); setPage(0); clearSelection() }}>
                  {t(f.label)} <span className="ml-1 tabular-nums opacity-80">{n}</span>
                </Button>
              )
            })}
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); clearSelection() }} placeholder={t("Search title or file")} aria-label={t("Search title or file")} className="ml-auto w-full @md:w-64" />
          </div>

          {imp.rows.length > 0 && (
            // One quiet header: how many books, and, once some are selected, what can be done with them.
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 text-sm" role="group" aria-label={t("Actions for the books shown")}>
              <Checkbox
                checked={pageSelected ? true : selectable.some((r) => selected.has(r.id)) ? "indeterminate" : false}
                onCheckedChange={() => {
                  setSelectAll(false)
                  toggleSelectPage()
                }}
                aria-label={t("Select all on this page")}
              />
              {selected.size === 0 ? (
                <p className="text-muted-foreground">
                  {q.trim() ? t("Books matching this search") : t("{{n}} books", { n: activeCount })}
                </p>
              ) : (
                <>
                  <p className="font-medium">
                    {selectAll ? t("All {{n}} selected", { n: activeCount }) : t("{{n}} selected", { n: selected.size })}
                  </p>
                  {!selectAll && pageSelected && total !== undefined && total > imp.rows.length && (
                    <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setSelectAll(true)}>
                      {t("Select all {{n}} in this view", { n: total })}
                    </Button>
                  )}
                  <span className="mr-auto" />
                  <Button size="sm" variant="ghost" onClick={clearSelection}>{t("Clear")}</Button>
                  <Button size="sm" variant="ghost" onClick={toggleEncryptSelection}>
                    {encryptOff ? <LockOpen className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
                    {encryptOff ? t("Don't encrypt") : t("Encrypt")}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-700 hover:text-red-800" onClick={() => (selectAll ? setConfirmRemove(true) : setConfirmSelected(true))}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    {t("Remove")}
                  </Button>
                </>
              )}
            </div>
          )}

          {imp.rows.length === 0 && !imp.rowsLoading ? (
            <p className="rounded-xl border p-8 text-center text-muted-foreground">{t("Nothing here.")}</p>
          ) : (
            <RowList
              key={page}
              rows={imp.rows}
              needsFile={(r) => !imp.hasFile(r)}
              onOpen={setEditing}
              onDetails={(r) => setViewingId(r.id)}
              onRemove={imp.removeRow}
              onToggleEncrypted={(r) => imp.patchRow(r, { encrypted: !r.encrypted })}
              onSelect={select}
              selected={selected}
              upload={(r) => (r.state !== "matched" || r.staged ? undefined : imp.failedUploads.has(r.id) ? "failed" : imp.uploading && imp.hasFile(r) ? "uploading" : undefined)}
              onRetryUpload={imp.retryUploads}
            />
          )}

          {total !== undefined && <Pager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />}
          <p className="text-center text-xs text-muted-foreground">{t("Kept for {{days}} days after your last change.", { days: retention })}</p>

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
            <Button disabled={busy || imp.importing || summary.ready === 0} onClick={() => imp.runImport()}>
              {(busy || imp.importing) && <Spinner className="mr-2" aria-hidden />}
              {imp.importing ? t("Importing…") : t("Import {{n}} books", { n: summary.ready })}
            </Button>
          </div>

          <RowDetails
            row={imp.rows.find((r) => r.id === viewingId) ?? null}
            onClose={() => setViewingId(null)}
            onChangeEdition={(r) => {
              setViewingId(null)
              setEditing(r)
            }}
          />
          <EditionSheet batchId={imp.batchId!} row={editing} onClose={() => setEditing(null)} onPick={(r, olid) => imp.patchRow(r, { olid })}
            onStartOver={() => {
              setEditing(null)
              imp.clearBatch()
            }}
          />
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <ImportHistory batchId={imp.batchId!} total={importedCount} retentionDays={retention} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
