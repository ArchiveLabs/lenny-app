"use client"

import { ReactNode } from "react"
import { BookOpen, ChevronRight, Lock, Unlock } from "lucide-react"
import { Card, CardContent, CardFooter } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { LennyBook } from "@/types/api"
import { BookEditSheet } from "@/components/BookEditSheet"
import { useTranslation } from "react-i18next"

export function FormatBadge({ formats }: { formats: string }) {
  const labels: Record<string, string> = {
    EPUB: "EPUB",
    PDF: "PDF",
    EPUB_PDF: "EPUB + PDF",
  }
  return (
    <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 text-[11px] font-bold text-foreground">
      {labels[formats] ?? formats}
    </span>
  )
}

export function BookCardSkeleton() {
  return (
    <div className="flex gap-3 rounded-lg border border-border/60 bg-card p-3">
      <Skeleton className="h-28 w-20 shrink-0 rounded-md" />
      <div className="flex flex-1 flex-col justify-between py-0.5">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-3 w-24" />
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/50">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-5 w-10" />
        </div>
      </div>
    </div>
  )
}

export interface BaseBookCardProps {
  title: string
  author: string
  coverUrl: string | null
  idBadge?: ReactNode
  topRightBadge?: ReactNode
  footer?: ReactNode
  contentMiddle?: ReactNode
  selectMode?: boolean
  selected?: boolean
  onSelectChange?: (checked: boolean) => void
}

export function BaseBookCard({ title, author, coverUrl, idBadge, topRightBadge, footer, contentMiddle, selectMode, selected, onSelectChange }: BaseBookCardProps) {
  return (
    <Card className={`group relative flex flex-row items-stretch gap-3 border bg-card py-3 pr-7 shadow-sm transition-all duration-200 hover:shadow-md ${
      selectMode && selected ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40 hover:bg-accent/20"
    } ${selectMode ? "pl-2" : "pl-3"}`}>
      {!selectMode && (
        <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
      )}

      {selectMode && (
        <div
          className="flex shrink-0 items-center pr-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox checked={!!selected} onCheckedChange={(c) => onSelectChange?.(!!c)} aria-label={`Select ${title}`} />
        </div>
      )}

      {/* Cover — a fixed-size thumbnail, deliberately separate from the details column */}
      <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md bg-muted/50">
        {coverUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={coverUrl}
            alt={`${title} cover`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-5 w-5 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Details */}
      <CardContent className="flex min-w-0 flex-1 flex-col justify-between p-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 h-10 text-sm font-bold leading-snug tracking-tight text-foreground group-hover:text-primary transition-colors duration-200" title={title}>
              {title}
            </h3>
            <p className="line-clamp-1 text-xs text-muted-foreground">{author}</p>
          </div>
          {topRightBadge && <div className="flex shrink-0 items-center gap-1.5">{topRightBadge}</div>}
        </div>

        <div className="flex items-center gap-2 min-h-[18px]">
          {idBadge && (
            <span className="shrink-0 rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {idBadge}
            </span>
          )}
          <div className="min-w-0 flex-1">{contentMiddle}</div>
        </div>

        {footer && (
          <CardFooter className="mt-2 flex items-center justify-between gap-2 border-t border-border/50 p-0 pt-2">
            {footer}
          </CardFooter>
        )}
      </CardContent>
    </Card>
  )
}

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
  const coverUrl = book.cover_i
    ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
    : null
  const author = book.author_name && book.author_name.length > 0 ? book.author_name.join(", ") : t("Unknown Author")

  const card = (
    <BaseBookCard
      title={book.title}
      author={author}
      coverUrl={coverUrl}
      idBadge={book.olid}
      selectMode={selectMode}
      selected={selected}
      onSelectChange={onSelectChange}
      topRightBadge={
        book.lenny.encrypted ? (
          <span className="flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
            <Lock className="h-3 w-3" />
            DRM
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-md bg-green-500/10 border border-green-500/20 px-1.5 py-1 text-[10px] font-bold text-green-700 dark:text-green-400">
            <Unlock className="h-3 w-3" />
            Open
          </span>
        )
      }
      footer={
        <>
          <FormatBadge formats={book.lenny.formats} />
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">{t("Copies")}</span>
            <span className="text-xs font-bold text-foreground/80">{book.lenny.available_copies}</span>
          </div>
        </>
      }
    />
  )

  if (selectMode) {
    return (
      <div className="cursor-pointer" onClick={() => onSelectChange?.(!selected)}>
        {card}
      </div>
    )
  }

  return <BookEditSheet book={book}>{card}</BookEditSheet>
}
