"use client"

import { useState } from "react"
import Link from "next/link"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { useBackfillMatchDetails } from "@/hooks/import/use-backfill"
import { importApi } from "@/lib/import/api"
import type { ImportRow } from "@/types/import"
import { Notice } from "./Notice"
import { Pager } from "./Pager"
import { RowDetails, openLibraryUrl } from "./RowDetails"
import { displayAuthor, displayTitle, editionKey } from "@/lib/import/display"

export const HISTORY_PAGE_SIZE = 50

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** "Today", "Yesterday", or a date; rows with no time are "Earlier". */
export function dayLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "Earlier"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Earlier"
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (dayKey(d) === dayKey(now)) return "Today"
  if (dayKey(d) === dayKey(yesterday)) return "Yesterday"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) })
}

export const timeOf = (iso: string | null | undefined) => {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""
}

/** Rows (already newest first) in runs of the same day, in order. */
export function groupByDay(rows: ImportRow[], now: Date = new Date()): { label: string; rows: ImportRow[] }[] {
  const groups: { label: string; rows: ImportRow[] }[] = []
  for (const r of rows) {
    const label = dayLabel(r.imported_at, now)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.rows.push(r)
    else groups.push({ label, rows: [r] })
  }
  return groups
}

/** Books that have been imported, newest first, in a table with the time each was imported. */
export function ImportHistory({ batchId, total, retentionDays, now }: { batchId: number; total: number; retentionDays: number; now?: Date }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const [viewingId, setViewingId] = useState<number | null>(null)
  const history = useQuery({
    queryKey: ["import-rows", batchId, "history", page],
    queryFn: () => importApi.rows(batchId, { state: "imported", order: "imported_at_desc", offset: page * HISTORY_PAGE_SIZE, limit: HISTORY_PAGE_SIZE }),
    staleTime: 0,
    placeholderData: keepPreviousData,
    retry: false,
  })
  const rows = history.data?.rows ?? []
  const qc = useQueryClient()
  useBackfillMatchDetails(rows, (r) =>
    importApi.patchRow(batchId, r.id, { olid: r.olid! }).then(() => qc.invalidateQueries({ queryKey: ["import-rows", batchId] })),
  )
  const count = history.data?.total ?? total

  if (history.isError) {
    return (
      <Notice tone="error" action={<Button size="sm" onClick={() => history.refetch()}>{t("Try again")}</Button>}>
        {t("Could not load the history.")}
      </Notice>
    )
  }
  if (history.isLoading) return <Spinner aria-label={t("Loading")} />
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center">
        <p className="font-medium">{t("Nothing imported yet")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("Books you import show up here for {{days}} days.", { days: retentionDays })}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("{{n}} imported. History is kept for {{days}} days.", { n: count.toLocaleString("en-US"), days: retentionDays })}
        </p>
        <Button size="sm" variant="outline" asChild>
          <Link href="/library">{t("View in Library")}</Link>
        </Button>
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Book")}</TableHead>
              <TableHead className="w-44">{t("Open Library")}</TableHead>
              <TableHead className="w-24 text-right">{t("Imported")}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupByDay(rows, now).map((g) => (
              <GroupRows key={g.label} label={g.label} rows={g.rows} onDetails={(r) => setViewingId(r.id)} />
            ))}
          </TableBody>
        </Table>
      </div>
      <Pager page={page} total={count} pageSize={HISTORY_PAGE_SIZE} onPage={setPage} />
      <RowDetails row={rows.find((r) => r.id === viewingId) ?? null} onClose={() => setViewingId(null)} onChangeEdition={() => {}} />
    </div>
  )
}

function GroupRows({ label, rows, onDetails }: { label: string; rows: ImportRow[]; onDetails: (r: ImportRow) => void }) {
  const { t } = useTranslation()
  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell colSpan={4} className="py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(label)} · {t("{{n}} books", { n: rows.length })}
        </TableCell>
      </TableRow>
      {rows.map((r) => {
        const title = displayTitle(r)
        return (
          <TableRow key={r.id}>
            <TableCell className="max-w-0 whitespace-normal">
              <p className="truncate font-medium">{title}</p>
              <p className="truncate text-sm text-muted-foreground">{displayAuthor(r)}</p>
            </TableCell>
            <TableCell>
              {r.olid && (
                <a
                  href={openLibraryUrl(r.olid)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t("Linked to Open Library")}
                  className="inline-flex items-center gap-1.5 text-sm tabular-nums text-green-700 underline-offset-4 hover:underline"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  {editionKey(r.olid)}
                </a>
              )}
            </TableCell>
            <TableCell className="text-right text-sm tabular-nums text-muted-foreground" title={r.imported_at ?? undefined}>{timeOf(r.imported_at)}</TableCell>
            <TableCell>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label={t("Show details for {{name}}", { name: title })} onClick={() => onDetails(r)}>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </TableCell>
          </TableRow>
        )
      })}
    </>
  )
}
