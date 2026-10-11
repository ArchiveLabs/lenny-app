"use client"

import { BookOpen, Lock, Unlock } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { LennyBook } from "@/types/api"
import { BookEditSheet } from "@/components/BookEditSheet"
import { ShareButton } from "@/components/library/ShareButton"
import { useTranslation } from "react-i18next"

const FORMAT_LABELS: Record<string, string> = { EPUB: "EPUB", PDF: "PDF", EPUB_PDF: "EPUB + PDF" }

export function BookCardSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border p-2">
      <Skeleton className="aspect-[2/3] w-full rounded-lg" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

/** A book as a cover tile, the same shape as the free books cards: cover, title, author, access and copies. */
export function BookCard({
  book,
  selectMode,
  selected,
  onSelectChange,
}: {
  book: LennyBook
  selectMode?: boolean
  selected?: boolean
  onSelectChange?: (checked: boolean) => void
}) {
  const { t } = useTranslation()
  const coverUrl = book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : null
  const author = book.author_name && book.author_name.length > 0 ? book.author_name.join(", ") : t("Unknown Author")
  const copies = book.lenny.available_copies
  const format = FORMAT_LABELS[book.lenny.formats] // an unknown value is not worth showing
  const picked = !!selectMode && !!selected

  const card = (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        // A tile is a button: Enter or Space does what a click does.
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault()
          e.currentTarget.click()
        }
      }}
      className={`group relative flex h-full cursor-pointer flex-col gap-2 rounded-xl border bg-card p-2 text-left shadow-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
        picked ? "border-primary ring-2 ring-primary" : ""
      }`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-muted">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={`${book.title} cover`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/30" aria-hidden />
          </div>
        )}
        {book.lenny.encrypted ? (
          <Badge variant="secondary" className="absolute left-2 top-2 gap-1 bg-amber-100 text-amber-800">
            <Lock className="h-3 w-3" aria-hidden />
            DRM
          </Badge>
        ) : (
          <Badge variant="secondary" className="absolute left-2 top-2 gap-1 bg-green-100 text-green-800">
            <Unlock className="h-3 w-3" aria-hidden />
            Open
          </Badge>
        )}
        <div className="absolute right-2 top-2" onClick={(e) => e.stopPropagation()}>
          {selectMode ? (
            <Checkbox
              checked={!!selected}
              onCheckedChange={(c) => onSelectChange?.(!!c)}
              aria-label={`Select ${book.title}`}
              className="h-5 w-5 bg-background shadow-sm"
            />
          ) : (
            <span className="flex rounded-full bg-background/90 shadow-sm">
              <ShareButton olid={book.olid} title={book.title} />
            </span>
          )}
        </div>
      </div>
      <span className="line-clamp-2 min-h-10 text-sm font-semibold leading-tight" title={book.title}>{book.title}</span>
      <span className="line-clamp-1 text-xs text-muted-foreground">{author}</span>
      <span className="text-xs text-muted-foreground">
        {[format, `${copies} ${copies === 1 ? t("copy") : t("copies")}`].filter(Boolean).join(" · ")}
      </span>
    </div>
  )

  if (selectMode) {
    return <div onClick={() => onSelectChange?.(!selected)}>{card}</div>
  }

  return <BookEditSheet book={book}>{card}</BookEditSheet>
}
