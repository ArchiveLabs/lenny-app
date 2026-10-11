"use client"

import { memo } from "react"
import { AlertTriangle, CheckCircle2, ChevronRight, CircleSlash, Copy, Loader2, Lock, LockOpen, Pencil, RotateCw, SearchX, Trash2, XCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Spinner } from "@workspace/ui/components/spinner"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import type { ImportRow } from "@/types/import"

export const editionKey = (olid: number) => `OL${olid}M`

/** An auto-picked match under this gets a "Check" badge; at or above it the match needs no comment. */
export const CHECK_BELOW = 95

type Tone = { label: string; icon?: React.ElementType; spin?: boolean; className: string; title?: string }

/** The one badge a row may show: only what needs the admin's attention, otherwise nothing. */
export function statusBadge(row: ImportRow): Tone | null {
  switch (row.state) {
    case "queued":
      return { label: "Matching", icon: Loader2, spin: true, className: "text-muted-foreground" }
    case "needs_review":
      return { label: "Needs review", icon: AlertTriangle, className: "border-amber-300 text-amber-700" }
    case "no_match":
      return { label: "No match", icon: SearchX, className: "border-red-300 text-red-700" }
    case "duplicate":
      return { label: "In library", icon: Copy, className: "text-muted-foreground" }
    case "not_epub":
      return { label: "Not an EPUB", icon: CircleSlash, className: "text-muted-foreground" }
    case "failed":
      return { label: "Failed", icon: XCircle, className: "border-red-300 text-red-700" }
    case "importing":
      return { label: "Importing", icon: Loader2, spin: true, className: "text-blue-700" }
    case "imported":
      return { label: "Imported", icon: CheckCircle2, className: "border-transparent text-green-700" }
    case "matched":
      return row.auto_picked && row.confidence != null && row.confidence < CHECK_BELOW
        ? { label: "Check", icon: AlertTriangle, className: "border-amber-300 text-amber-700", title: `${Math.round(row.confidence)}% match` }
        : null
  }
}

const ICON_BUTTON = "h-11 w-11 @2xl:h-8 @2xl:w-8" // 44px touch targets on narrow screens

export const RowItem = memo(function RowItem({
  row,
  onOpen,
  onDetails,
  onRemove,
  onToggleEncrypted,
  onSelect,
  selected,
  upload,
  onRetryUpload,
  needsFile,
}: {
  row: ImportRow
  onOpen: (r: ImportRow) => void
  onDetails: (r: ImportRow) => void
  onRemove: (r: ImportRow) => void
  onToggleEncrypted: (r: ImportRow) => void
  onSelect: (r: ImportRow, selected: boolean) => void
  selected: boolean
  /** Only while a file is being sent or after it gave up; a finished upload shows nothing. */
  upload?: "uploading" | "failed"
  onRetryUpload?: () => void
  needsFile: boolean
}) {
  const { t } = useTranslation()
  const badge = statusBadge(row)
  const title = row.match_title || row.title || row.path.split("/").pop()
  const author = row.match_author || row.author
  const locked = row.state === "imported" || row.state === "not_epub" || row.state === "importing"
  const canPick = !locked && row.state !== "duplicate"
  const mustChoose = row.state === "needs_review" || row.state === "no_match"
  const BadgeIcon = badge?.icon

  return (
    <div className={`flex items-center gap-3 border-b px-3 py-3 ${selected ? "bg-muted/40" : ""}`}>
      <Checkbox
        checked={selected}
        disabled={row.state === "importing"}
        onCheckedChange={(c) => onSelect(row, c === true)}
        aria-label={t("Select {{name}}", { name: title })}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 @2xl:flex-row @2xl:items-center @2xl:gap-4">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate font-semibold">{title}</p>
          <p className="flex min-w-0 items-center gap-1.5 truncate text-sm text-muted-foreground">
            <span className="truncate">{[author, row.year].filter(Boolean).join(" · ") || " "}</span>
            {row.olid && (
              <a
                href={`https://openlibrary.org/books/${editionKey(row.olid)}`}
                target="_blank"
                rel="noopener noreferrer"
                title={t("Linked to Open Library")}
                className="inline-flex shrink-0 items-center gap-1 text-green-700 underline-offset-4 hover:underline"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                {editionKey(row.olid)}
              </a>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground/70" title={row.path}>{row.path}</p>
          {row.error && <p className="text-xs text-red-700">{row.error}</p>}
          {needsFile && row.state === "matched" && !row.staged && (
            <p className="text-xs text-amber-700">{t("Drop this file again to import it")}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 @2xl:justify-end">
          {badge && BadgeIcon && (
            <Badge variant="outline" className={`gap-1 ${badge.className}`} title={badge.title}>
              <BadgeIcon className={`h-3 w-3 ${badge.spin ? "animate-spin" : ""}`} aria-hidden />
              {t(badge.label)}
            </Badge>
          )}
          {upload === "uploading" && (
            <Spinner className="text-muted-foreground" role="img" aria-label={t("Uploading")} />
          )}
          {upload === "failed" && (
            <Button size="sm" variant="outline" className="gap-1 border-red-300 text-red-700" onClick={onRetryUpload} title={t("Try uploading again")}>
              <RotateCw className="h-3 w-3" aria-hidden />
              {t("Not uploaded")}
            </Button>
          )}
          {!locked && row.state !== "duplicate" && (
            <Button
              size="icon"
              variant="ghost"
              className={`${ICON_BUTTON} ${row.encrypted ? "text-foreground" : "text-muted-foreground"}`}
              aria-pressed={row.encrypted}
              aria-label={t("Encrypt {{name}}", { name: title })}
              title={t("Encrypt: readers must log in")}
              onClick={() => onToggleEncrypted(row)}
            >
              {row.encrypted ? <Lock className="h-4 w-4 fill-current" aria-hidden /> : <LockOpen className="h-4 w-4" aria-hidden />}
            </Button>
          )}
          {canPick &&
            (mustChoose ? (
              <Button size="sm" onClick={() => onOpen(row)}>{t("Choose edition")}</Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className={`${ICON_BUTTON} text-muted-foreground`}
                aria-label={t("Change edition for {{name}}", { name: title })}
                title={t("Change edition")}
                onClick={() => onOpen(row)}
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </Button>
            ))}
          <Button
            size="icon"
            variant="ghost"
            className={`${ICON_BUTTON} text-muted-foreground`}
            aria-label={t("Show details for {{name}}", { name: title })}
            title={t("Details")}
            onClick={() => onDetails(row)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
          {row.state !== "importing" && (
            <Button
              size="icon"
              variant="ghost"
              className={`${ICON_BUTTON} text-muted-foreground hover:text-red-700`}
              aria-label={t("Remove {{name}} from this list", { name: title })}
              title={t("The book is not imported. Drop the file again to bring it back.")}
              onClick={() => onRemove(row)}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})
