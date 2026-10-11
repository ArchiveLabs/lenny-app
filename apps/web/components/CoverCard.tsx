"use client"

import type { ReactNode } from "react"
import { BookOpen } from "lucide-react"
import { Skeleton } from "@workspace/ui/components/skeleton"

/** The grid the cover cards sit in: compact, with room to breathe. Shared by the Library and the free books. */
export const COVER_GRID = "grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-4 gap-y-6"

export function CoverCardSkeleton() {
  return (
    <div className="space-y-2.5">
      <Skeleton className="aspect-[2/3] w-full rounded-lg" />
      <div className="space-y-1.5 px-0.5">
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

/**
 * A book as a cover with its title and author under it. The caller decides what goes on the cover (a lock, a
 * badge, a checkbox, a hover action) and in the status line. The whole card is a button: it takes focus, and
 * Enter or Space does what a click does.
 */
export function CoverCard({
  coverUrl,
  title,
  author,
  topLeft,
  hoverAction,
  status,
  picked,
}: {
  coverUrl?: string | null
  title: string
  author?: string | null
  /** On the cover, top left: a lock, a badge or a checkbox. */
  topLeft?: ReactNode
  /** On the cover, bottom right, quiet until hover or focus (always on touch screens). */
  hoverAction?: ReactNode
  /** A line under the author, such as availability. */
  status?: ReactNode
  /** Ring the cover: this one is picked. */
  picked?: boolean
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault()
          e.currentTarget.click()
        }
      }}
      className="group flex h-full cursor-pointer flex-col gap-2.5 rounded-xl outline-none"
    >
      <div
        className={`relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-muted shadow-sm transition group-hover:shadow-md group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50 ${
          picked ? "ring-2 ring-primary" : ""
        }`}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={`${title} cover`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-7 w-7 text-muted-foreground/30" aria-hidden />
          </div>
        )}
        {topLeft && <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1">{topLeft}</div>}
        {hoverAction && (
          <div
            className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/50 to-transparent p-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            {hoverAction}
          </div>
        )}
      </div>

      <div className="space-y-0.5 px-0.5">
        {/* Paragraphs, not spans: line-clamp needs its own display, which "block" on a span would override. */}
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug" title={title}>{title}</p>
        {author && <p className="line-clamp-1 text-xs text-muted-foreground" title={author}>{author}</p>}
        {status}
      </div>
    </div>
  )
}
