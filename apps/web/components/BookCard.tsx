"use client"

import { ReactNode } from "react"
import { BookOpen, Lock, Unlock } from "lucide-react"
import { Card, CardContent, CardFooter } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { LennyBook } from "@/types/api"
import { useTranslation } from "react-i18next"

export function FormatBadge({ formats }: { formats: string }) {
  const labels: Record<string, string> = {
    EPUB: "EPUB",
    PDF: "PDF",
    EPUB_PDF: "EPUB + PDF",
  }
  return (
    <span className="inline-flex items-center rounded-md border border-border/50 bg-background/95 px-2 py-0.5 text-[11px] font-bold text-foreground shadow-sm backdrop-blur-md">
      {labels[formats] ?? formats}
    </span>
  )
}

export function BookCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border/50 bg-card">
      <div className="relative h-48 w-full bg-muted/30 p-4 flex items-center justify-center">
        <Skeleton className="h-full w-[100px]" />
        <Skeleton className="absolute left-3 top-3 h-5 w-20 rounded-md" />
      </div>
      <div className="flex flex-1 flex-col px-4 pt-4 pb-3 gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/3 mt-1" />
        <div className="mt-auto pt-4 flex items-end justify-between">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-2 w-16" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
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
}

export function BaseBookCard({ title, author, coverUrl, idBadge, topRightBadge, footer, contentMiddle }: BaseBookCardProps) {
  const { t } = useTranslation()
  return (
    <Card className="group relative flex flex-col overflow-hidden border border-border/50 bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40">
      <div className="relative h-52 w-full overflow-hidden bg-gradient-to-b from-muted/40 to-muted/10 p-4 flex items-center justify-center">
        {coverUrl ? (
          <>
            <div className="absolute inset-0 bg-background/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt={`${title} cover`}
              loading="lazy"
              decoding="async"
              className="relative z-0 h-full w-auto object-contain drop-shadow-xl transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </>
        ) : (
          <div className="relative z-0 flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/20 bg-muted/5 transition-colors group-hover:border-primary/20">
            <BookOpen className="h-8 w-8 text-muted-foreground/20 transition-transform duration-300 group-hover:scale-110 group-hover:text-primary/40" />
            <span className="text-[11px] font-medium text-muted-foreground/50">{t("No Cover Art")}</span>
          </div>
        )}

        {idBadge && (
          <div className="absolute left-3 top-3 z-20 flex items-center rounded-md border border-border/50 bg-background/95 px-2 py-1 text-[11px] font-bold text-foreground shadow-sm backdrop-blur-md">
            {idBadge}
          </div>
        )}

        {topRightBadge && (
          <div className="absolute right-3 top-3 z-20">
            {topRightBadge}
          </div>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col px-4 pt-4 pb-0">
        <h3 className="mb-1 line-clamp-2 text-[15px] font-bold leading-snug tracking-tight group-hover:text-primary transition-colors duration-200">
          {title}
        </h3>
        <p className="line-clamp-1 text-[13px] font-medium text-muted-foreground">{author}</p>
        {contentMiddle}
      </CardContent>

      {footer && <CardFooter className="px-4 pt-3 pb-4 flex items-center justify-between">
        {footer}
      </CardFooter>}
    </Card>
  )
}

export function BookCard({ book }: { book: LennyBook }) {
  const { t } = useTranslation()
  const coverUrl = book.cover_i
    ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
    : null
  const author = book.author_name && book.author_name.length > 0 ? book.author_name.join(", ") : t("Unknown Author")

  return (
    <BaseBookCard
      title={book.title}
      author={author}
      coverUrl={coverUrl}
      idBadge={book.olid}
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
}
