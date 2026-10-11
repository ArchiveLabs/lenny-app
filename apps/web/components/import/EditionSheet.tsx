"use client"

import { useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { ExternalLink, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { importApi } from "@/lib/import/api"
import type { ImportRow } from "@/types/import"
import { EditionCard } from "./EditionCard"
import { EditionError } from "./EditionError"
import { ADD_ON_OPEN_LIBRARY_URL, EditionSearch } from "./EditionSearch"

export { ADD_ON_OPEN_LIBRARY_URL }

export function EditionSheet({
  batchId,
  row,
  onClose,
  onPick,
  onStartOver,
}: {
  batchId: number
  row: ImportRow | null
  onClose: () => void
  onPick: (row: ImportRow, olid: number) => Promise<void>
  /** The list expired: clear it and begin again. */
  onStartOver: () => void
}) {
  const { t } = useTranslation()
  const searchBox = useRef<HTMLInputElement>(null)
  const candidates = useQuery({
    queryKey: ["import-candidates", batchId, row?.id],
    queryFn: () => importApi.candidates(batchId, row!.id),
    enabled: !!row,
    staleTime: 60_000,
    retry: false,
  })

  const pick = async (olid: number) => {
    if (!row) return
    await onPick(row, olid)
    onClose()
  }

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault() // Radix would focus the close button
          searchBox.current?.focus()
        }}
      >
        <SheetHeader>
          <SheetTitle>{t("Choose an edition")}</SheetTitle>
          <SheetDescription className="truncate">{row?.title || row?.path}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          <section className="space-y-2" aria-live="polite">
            <h3 className="text-sm font-semibold">{t("Suggestions from Open Library")}</h3>
            {candidates.isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-label={t("Loading")} />}
            {candidates.isError && <EditionError error={candidates.error} onRetry={() => candidates.refetch()} onStartOver={onStartOver} />}
            {candidates.data?.candidates.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("No suggestions for this book.")}</p>
            )}
            <ul className="space-y-2">
              {candidates.data?.candidates.map((c) => (
                <li key={c.olid}>
                  <EditionCard c={c} selected={row?.olid === c.olid} note={c.score != null ? `${Math.round(c.score)}%` : undefined} onPick={pick} />
                </li>
              ))}
            </ul>
          </section>

          {row && <EditionSearch key={row.id} ref={searchBox} batchId={batchId} row={row} onPick={pick} onStartOver={onStartOver} />}

          <a
            href={ADD_ON_OPEN_LIBRARY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t("Not listed? Add it on Open Library")}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </SheetContent>
    </Sheet>
  )
}
