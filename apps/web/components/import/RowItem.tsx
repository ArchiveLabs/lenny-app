"use client"

import { memo } from "react"
import { AlertTriangle, CheckCircle2, CircleSlash, CloudCheck, Copy, Loader2, SearchX, Trash2, XCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import type { ImportRow, ImportRowState } from "@/types/import"

const STATE: Record<ImportRowState, { label: string; icon: React.ElementType; tone: string }> = {
  queued: { label: "Waiting to match", icon: Loader2, tone: "text-muted-foreground" },
  matched: { label: "Matched", icon: CheckCircle2, tone: "text-green-700" },
  needs_review: { label: "Needs review", icon: AlertTriangle, tone: "text-amber-700" },
  no_match: { label: "No match", icon: SearchX, tone: "text-red-700" },
  duplicate: { label: "Already in library", icon: Copy, tone: "text-muted-foreground" },
  not_epub: { label: "Not an EPUB", icon: CircleSlash, tone: "text-muted-foreground" },
  importing: { label: "Importing", icon: Loader2, tone: "text-blue-700" },
  imported: { label: "Imported", icon: CheckCircle2, tone: "text-green-700" },
  failed: { label: "Failed", icon: XCircle, tone: "text-red-700" },
}

export const editionKey = (olid: number) => `OL${olid}M`

export const RowItem = memo(function RowItem({
  row,
  onOpen,
  onRemove,
  onToggleEncrypted,
  needsFile,
}: {
  row: ImportRow
  onOpen: (r: ImportRow) => void
  onRemove: (r: ImportRow) => void
  onToggleEncrypted: (r: ImportRow) => void
  needsFile: boolean
}) {
  const { t } = useTranslation()
  const s = STATE[row.state]
  const Icon = s.icon
  const title = row.match_title || row.title || row.path.split("/").pop()
  const author = row.match_author || row.author
  const locked = row.state === "imported" || row.state === "not_epub" || row.state === "importing"
  const canPick = !locked && row.state !== "duplicate"

  return (
    <div className={`flex flex-col gap-2 border-b px-3 py-3 @2xl:flex-row @2xl:items-center @2xl:gap-4`}>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate font-semibold">{title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[author, row.olid ? editionKey(row.olid) : null, row.year].filter(Boolean).join(" · ") || " "}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={row.path}>{row.path}</p>
        {row.error && <p className="text-xs text-red-700">{row.error}</p>}
        {needsFile && row.state === "matched" && !row.staged && (
          <p className="text-xs text-amber-700">{t("Drop this file again to import it")}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 @2xl:justify-end">
        <Badge variant="outline" className={`gap-1 ${s.tone}`}>
          <Icon className={`h-3 w-3 ${row.state === "queued" || row.state === "importing" ? "animate-spin" : ""}`} aria-hidden />
          {t(s.label)}
          {row.state === "matched" && row.auto_picked && row.confidence != null ? ` ${row.confidence}%` : ""}
        </Badge>
        {row.staged && row.state === "matched" && (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <CloudCheck className="h-3 w-3" aria-hidden />
            {t("Uploaded")}
          </Badge>
        )}
        {!locked && row.state !== "duplicate" && (
          <label className="flex items-center gap-1.5 text-sm">
            <Checkbox checked={row.encrypted} onCheckedChange={() => onToggleEncrypted(row)} />
            {t("Encrypt")}
          </label>
        )}
        {canPick && (
          <Button size="sm" variant={row.state === "needs_review" || row.state === "no_match" ? "default" : "outline"} onClick={() => onOpen(row)}>
            {row.state === "matched" ? t("Change edition") : t("Choose edition")}
          </Button>
        )}
        {row.state !== "importing" && (
          <Button
            size="sm"
            variant="ghost"
            aria-label={t("Remove {{name}} from this list", { name: title })}
            title={t("The book is not imported. Drop the file again to bring it back.")}
            onClick={() => onRemove(row)}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            {t("Remove")}
          </Button>
        )}
      </div>
    </div>
  )
})
