"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"

/** 1-based page numbers to show: first, last, and the current page with one neighbour each side; null is a gap. */
export function pageNumbers(page: number, pages: number): (number | null)[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages))
  const out: (number | null)[] = []
  let prev = 0
  for (const n of [...keep].sort((a, b) => a - b)) {
    if (n - prev > 1) out.push(null)
    out.push(n)
    prev = n
  }
  return out
}

/** `page` is 0-based; the buttons show 1-based numbers. */
export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  const { t } = useTranslation()
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null
  const from = page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  return (
    <nav aria-label={t("Pages")} className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground tabular-nums">{t("Showing {{from}}–{{to}} of {{total}}", { from, to, total })}</p>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label={t("Previous page")}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        {pageNumbers(page + 1, pages).map((n, i) =>
          n === null ? (
            <span key={`gap${i}`} className="px-1 text-muted-foreground" aria-hidden>…</span>
          ) : (
            <Button
              key={n}
              size="sm"
              variant={n === page + 1 ? "default" : "outline"}
              aria-current={n === page + 1 ? "page" : undefined}
              aria-label={t("Page {{n}}", { n })}
              className="min-w-9 tabular-nums"
              onClick={() => onPage(n - 1)}
            >
              {n}
            </Button>
          ),
        )}
        <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label={t("Next page")}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
