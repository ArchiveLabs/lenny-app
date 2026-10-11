"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { ExternalLink, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { importApi } from "@/lib/import/api"
import type { ImportRow } from "@/types/import"
import { editionKey } from "./RowItem"

export const ADD_ON_OPEN_LIBRARY_URL = "https://openlibrary.org/books/add"

export function EditionSheet({
  batchId,
  row,
  onClose,
  onPick,
}: {
  batchId: number
  row: ImportRow | null
  onClose: () => void
  onPick: (row: ImportRow, olid: number) => Promise<void>
}) {
  const { t } = useTranslation()
  const [pasted, setPasted] = useState("")
  const candidates = useQuery({
    queryKey: ["import-candidates", batchId, row?.id],
    queryFn: () => importApi.candidates(batchId, row!.id),
    enabled: !!row,
    staleTime: 60_000,
    retry: false,
  })
  const lookup = useMutation({ mutationFn: (key: string) => importApi.lookupEdition(key) })

  const pick = async (olid: number) => {
    if (!row) return
    await onPick(row, olid)
    onClose()
  }

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("Choose an edition")}</SheetTitle>
          <SheetDescription className="truncate">{row?.title || row?.path}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          <section className="space-y-2" aria-live="polite">
            <h3 className="text-sm font-semibold">{t("Suggestions from Open Library")}</h3>
            {candidates.isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-label={t("Loading")} />}
            {candidates.isError && (
              <div className="space-y-2 text-sm">
                <p className="text-red-700">{t("Open Library did not answer. Try again in a moment.")}</p>
                <Button size="sm" variant="outline" onClick={() => candidates.refetch()}>{t("Try again")}</Button>
              </div>
            )}
            {candidates.data?.candidates.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("No suggestions for this book.")}</p>
            )}
            <ul className="space-y-2">
              {candidates.data?.candidates.map((c) => (
                <li key={c.olid}>
                  <button
                    type="button"
                    onClick={() => pick(c.olid)}
                    aria-current={row?.olid === c.olid}
                    className={`w-full rounded-lg border p-3 text-left hover:bg-muted/50 ${row?.olid === c.olid ? "border-primary" : ""}`}
                  >
                    <span className="block font-semibold">{c.title}</span>
                    <span className="block text-sm text-muted-foreground">
                      {[c.authors.join(", "), c.publisher, c.year, c.language].filter(Boolean).join(" · ")}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {editionKey(c.olid)}{c.score != null ? ` · ${Math.round(c.score)}%` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <Label htmlFor="paste-olid">{t("Or paste an Open Library edition link or key")}</Label>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (pasted.trim()) lookup.mutate(pasted.trim())
              }}
            >
              <Input id="paste-olid" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="OL123456M" autoComplete="off" spellCheck={false} />
              <Button type="submit" variant="outline" disabled={!pasted.trim() || lookup.isPending}>{t("Check")}</Button>
            </form>
            {lookup.isError && <p className="text-sm text-red-700">{(lookup.error as Error).message}</p>}
            {lookup.data && (
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                <p className="font-semibold">{lookup.data.title}</p>
                <p className="text-muted-foreground">
                  {[lookup.data.publisher, lookup.data.year, editionKey(lookup.data.olid)].filter(Boolean).join(" · ")}
                </p>
                {lookup.data.in_library && <p className="text-amber-700">{t("This edition is already in the library.")}</p>}
                <Button size="sm" onClick={() => pick(lookup.data!.olid)}>{t("Use this edition")}</Button>
              </div>
            )}
          </section>

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
