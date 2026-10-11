"use client"

import { Lock } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { LennyBook } from "@/types/api"
import { BookEditSheet } from "@/components/BookEditSheet"
import { CoverCard, CoverCardSkeleton } from "@/components/CoverCard"
import { ShareButton } from "@/components/library/ShareButton"
import { useTranslation } from "react-i18next"

export { COVER_GRID as BOOK_GRID } from "@/components/CoverCard"
export const BookCardSkeleton = CoverCardSkeleton

/**
 * A Library book as a cover card. What an admin needs at a glance: the cover, title and author, whether it is
 * locked (login required). Everything else, including the copies, is in the book sheet.
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
  const card = (
    <CoverCard
      coverUrl={coverUrl}
      title={book.title}
      author={author}
      picked={!!selectMode && !!selected}
      topLeft={
        selectMode ? (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={!!selected}
              onCheckedChange={(c) => onSelectChange?.(!!c)}
              aria-label={`Select ${book.title}`}
              className="h-5 w-5 bg-background shadow-sm"
            />
          </div>
        ) : (
          // Only the exception is flagged: a book that needs a login to read. Open books are the norm.
          book.lenny.encrypted && (
            <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800">
              <Lock className="h-3 w-3" aria-hidden />
              DRM
            </Badge>
          )
        )
      }
      hoverAction={
        selectMode ? undefined : (
          <span className="rounded-md bg-background/90 shadow-sm">
            <ShareButton olid={book.olid} title={book.title} />
          </span>
        )
      }
    />
  )

  if (selectMode) {
    return <div onClick={() => onSelectChange?.(!selected)}>{card}</div>
  }

  return <BookEditSheet book={book}>{card}</BookEditSheet>
}
