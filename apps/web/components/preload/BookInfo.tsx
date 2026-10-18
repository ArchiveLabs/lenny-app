"use client"

import { isHttpUrl } from "@/lib/safe-url"
import { useEffect, useState } from "react"
import { ExternalLink } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { ErrorNotice } from "@/components/ErrorNotice"
import { useLibraryBookMetadata } from "@/hooks/preload/use-preload"
import type { LibraryBookMetadata } from "@/types/preload"

/** "eng" becomes "English"; a code the browser does not know stays as it is. */
export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames("en", { type: "language" }).of(code) ?? code
  } catch {
    return code
  }
}

const sizeOf = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return null // 0 means unknown
  return bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

const dateOf = (iso?: string | null) => {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : null
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "" || children === false) return null
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

/** Past this many characters the description is folded, with a Show more. About six lines. */
const FOLD_AT = 420

function Description({ text }: { text: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const long = text.length > FOLD_AT
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("About this book")}</h3>
      <p className={`whitespace-pre-line text-sm leading-relaxed ${long && !open ? "line-clamp-6" : ""}`}>{text}</p>
      {long && (
        <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? t("Show less") : t("Show more")}
        </Button>
      )}
    </section>
  )
}


/** The facts about a book: rows, description, subject chips and links. Empty values are left out. */
export function BookInfo({ data, subjects }: { data: Omit<LibraryBookMetadata, "title" | "source_id"> & { source_id?: string | null }; subjects: string[] }) {
  const { t } = useTranslation()
  const links = data.links ?? {}
  const linkList = [
    [t("Open Library"), links.open_library],
    [t("Standard Ebooks"), links.standard_ebooks],
    [t("archive.org"), links.archive_org],
  ].filter((l): l is [string, string] => isHttpUrl(l[1]))
  return (
    <>
      <dl className="divide-y">
        <Row label={t("Publisher")}>{data.publisher}</Row>
        <Row label={t("Published")}>{data.publish_date}</Row>
        <Row label={t("Pages")}>{data.pages}</Row>
        <Row label={t("ISBN")}>{data.isbn}</Row>
        <Row label={t("Languages")}>{data.languages.length > 0 ? data.languages.map(languageName).join(", ") : null}</Row>
        <Row label={t("Size")}>{sizeOf(data.size)}</Row>
        <Row label={t("Added to the archive")}>{dateOf(data.added_at)}</Row>
        {/* Only a Standard Ebooks book has a source to name. */}
        <Row label={t("Source")}>{data.source_id ? t("Standard Ebooks via archive.org") : null}</Row>
      </dl>

      {data.description && <Description text={data.description} />}

      {subjects.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Subjects")}</h3>
          <ul className="flex flex-wrap gap-1.5">
            {subjects.map((s) => (
              <li key={s}><Badge variant="outline" className="font-normal">{s}</Badge></li>
            ))}
          </ul>
        </section>
      )}

      {linkList.length > 0 && (
        <nav aria-label={t("Links")} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {linkList.map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
              {label}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ))}
        </nav>
      )}
    </>
  )
}

/** Nothing to show: no row, description, subjects or link. */
export const hasNoInfo = (d: Parameters<typeof BookInfo>[0]["data"], subjects: string[]) =>
  !d.publisher && !d.publish_date && !d.pages && !d.isbn && d.languages.length === 0 && !d.description && subjects.length === 0 && !(d.size && d.size > 0) && !d.added_at && !d.source_id && !d.links?.open_library && !d.links?.standard_ebooks && !d.links?.archive_org

/** Loads one library book's details when `olid` is given, with its own loading, error and "more unavailable" states. */
export function BookInfoLoader({ olid, onGone }: { olid: number | null; onGone?: () => void }) {
  const { t } = useTranslation()
  const q = useLibraryBookMetadata(olid)
  const gone = q.isError && (q.error as { status?: number })?.status === 404
  useEffect(() => {
    if (gone) onGone?.()
  }, [gone, onGone])
  if (q.isLoading) {
    return (
      <div className="space-y-3" role="status" aria-label={t("Loading")}>
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
      </div>
    )
  }
  if (q.isError) {
    return gone ? (
      <p className="text-sm text-muted-foreground">{t("This book is no longer in your library.")}</p>
    ) : (
      <ErrorNotice error={q.error} onRetry={() => q.refetch()} texts={{ unreachable: "Open Library did not answer. Try again in a moment." }} />
    )
  }
  if (!q.data) return null
  const subjects = q.data.all_subjects.length ? q.data.all_subjects : q.data.subjects
  return (
    <div className="space-y-5">
      {!q.data.details_loaded && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {t("More details unavailable right now")}
          <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>{t("Try again")}</Button>
        </p>
      )}
      {q.data.details_loaded && hasNoInfo(q.data, subjects) ? (
        <p className="text-sm text-muted-foreground">{t("No more details are available for this book.")}</p>
      ) : (
        <BookInfo data={q.data} subjects={subjects} />
      )}
    </div>
  )
}
