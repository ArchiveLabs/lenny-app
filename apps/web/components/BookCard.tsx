"use client"

import { BookOpen, Lock } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { LennyBook } from "@/types/api"
import { BookEditSheet } from "@/components/BookEditSheet"
import { ShareButton } from "@/components/library/ShareButton"
import { useTranslation } from "react-i18next"

export function BookCardSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="aspect-[2/3] w-full rounded-lg" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

/**
 * A book as a cover. What an admin needs at a glance: the cover, title and author, whether it is locked (login
 * required), and whether a copy is free right now. Everything else is in the book sheet. Share appears over the
 * cover on hover or focus (always on touch screens), and a checkbox replaces it while selecting.
 */
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
  // Known only when the record carries a count: say nothing rather than guess.
  const availability = typeof copies === "number" ? (copies > 0 ? "available" : "on_loan") : null
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
      className="group flex h-full cursor-pointer flex-col gap-2 rounded-xl outline-none"
    >
      <div
        className={`relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-muted shadow-sm ring-offset-2 transition group-hover:shadow-md group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50 ${
          picked ? "ring-2 ring-primary" : ""
        }`}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={`${book.title} cover`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/30" aria-hidden />
          </div>
        )}

        {selectMode ? (
          <div className="absolute left-2 top-2" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={!!selected}
              onCheckedChange={(c) => onSelectChange?.(!!c)}
              aria-label={`Select ${book.title}`}
              className="h-5 w-5 bg-background shadow-sm"
            />
          </div>
        ) : (
          <>
            {/* Only the exception is flagged: a book that needs a login to read. Open books are the norm. */}
            {book.lenny.encrypted && (
              <Badge variant="secondary" className="absolute left-2 top-2 gap-1 bg-amber-100 text-amber-800">
                <Lock className="h-3 w-3" aria-hidden />
                DRM
              </Badge>
            )}
            {/* Quiet until wanted: hover, keyboard focus, or always on a touch screen */}
            <div
              className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/50 to-transparent p-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="rounded-md bg-background/90 shadow-sm">
                <ShareButton olid={book.olid} title={book.title} />
              </span>
            </div>
          </>
        )}
      </div>

      <div className="space-y-0.5">
        {/* Paragraphs, not spans: line-clamp needs its own display, which "block" on a span would override. */}
        <p className="line-clamp-2 text-sm font-semibold leading-tight" title={book.title}>{book.title}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground" title={author}>{author}</p>
        {availability && (
          <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${availability === "available" ? "bg-green-500" : "bg-amber-500"}`}
            />
            {availability === "available" ? t("Available") : t("On loan")}
          </span>
        )}
      </div>
    </div>
  )

  if (selectMode) {
    return <div onClick={() => onSelectChange?.(!selected)}>{card}</div>
  }

  return <BookEditSheet book={book}>{card}</BookEditSheet>
}
