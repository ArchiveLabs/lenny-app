"use client"

import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import type { ImportCandidate } from "@/types/import"
import { editionKey } from "@/lib/import/display"

/** What the percentage line says: a score under this is relative to the file and reads as alarming, so it is hidden. */
export const SHOW_SCORE_FROM = 60

/** How strong a match is, as a colour: strong (green), fair (amber), weak (grey). */
export const STRONG_SCORE = 85
export function scoreTone(score: number): "strong" | "fair" | "weak" {
  return score >= STRONG_SCORE ? "strong" : score >= SHOW_SCORE_FROM ? "fair" : "weak"
}
const TONE_CLASS = {
  strong: "border-green-300 bg-green-50 text-green-800",
  fair: "border-amber-300 bg-amber-50 text-amber-800",
  weak: "border-border bg-muted text-muted-foreground",
} as const

export function EditionCard({
  c,
  selected,
  active,
  id,
  note,
  score,
  onPick,
}: {
  c: ImportCandidate
  selected?: boolean
  active?: boolean
  id?: string
  /** A quiet word after the id, e.g. "Top result". */
  note?: string
  /** The match percentage, shown as a coloured pill so it can be seen at a glance. */
  score?: number | null
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
      <span className="flex items-start justify-between gap-2">
        <span className="font-semibold">{c.title}</span>
        {score != null && (
          <Badge
            variant="outline"
            data-tone={scoreTone(score)}
            title={t("{{n}}% match", { n: Math.round(score) })}
            className={`shrink-0 tabular-nums ${TONE_CLASS[scoreTone(score)]}`}
          >
            {Math.round(score)}%
          </Badge>
        )}
      </span>
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
