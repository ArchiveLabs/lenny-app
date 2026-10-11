"use client"

import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import type { ImportCandidate } from "@/types/import"
import { editionKey } from "@/lib/import/display"

/** What the percentage line says: a score under this is relative to the file and reads as alarming, so it is hidden. */
export const SHOW_SCORE_FROM = 60

export function EditionCard({
  c,
  selected,
  active,
  id,
  note,
  onPick,
}: {
  c: ImportCandidate
  selected?: boolean
  active?: boolean
  id?: string
  /** Replaces the percentage, e.g. "Top result". */
  note?: string
  onPick: (olid: number) => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      id={id}
      onClick={() => onPick(c.olid)}
      aria-current={selected}
      className={`w-full rounded-lg border p-3 text-left hover:bg-muted/50 ${selected ? "border-primary" : ""} ${active ? "bg-muted/50 ring-2 ring-ring" : ""}`}
    >
      <span className="block font-semibold">{c.title}</span>
      <span className="block text-sm text-muted-foreground">
        {[c.authors.join(", "), c.publisher, c.year, c.language].filter(Boolean).join(" · ")}
      </span>
      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{[editionKey(c.olid), note].filter(Boolean).join(" · ")}</span>
        {c.in_library && <Badge variant="secondary">{t("Already in your library")}</Badge>}
      </span>
    </button>
  )
}
