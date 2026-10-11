"use client"

import { useEffect, useState } from "react"
import { ExternalLink } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { ErrorNotice, errorKind } from "@/components/ErrorNotice"
import { usePreloadBook } from "@/hooks/preload/use-preload"
import type { PreloadBook, PreloadBookDetails } from "@/types/preload"

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

/** Read-only details for one free book, with the one action that matters: add it to the library. */
export function BookDetails({
  olid,
  listed,
  busy,
  onAdd,
  onClose,
  onGone,
}: {
  olid: number | null
  /** The catalog's own copy, so the header shows at once while the details load. */
  listed?: PreloadBook
  /** An add is running, so the button waits. */
  busy?: boolean
  onAdd: (olid: number) => void
  onClose: () => void
  /** The book is no longer in the catalog (404). */
  onGone: () => void
}) {
  const { t } = useTranslation()
  const q = usePreloadBook(olid)
  const gone = q.isError && errorKind(q.error) === "gone"

  useEffect(() => {
    if (gone) onGone()
  }, [gone, onGone])

  const book: (PreloadBook & Partial<PreloadBookDetails>) | undefined = q.data ?? listed
  const loaded = q.data?.details_loaded !== false
  const subjects = q.data?.all_subjects?.length ? q.data.all_subjects : (book?.subjects ?? [])
  const links = q.data?.links ?? {}
  const linkList = [
    [t("Open Library"), links.open_library],
    [t("Standard Ebooks"), links.standard_ebooks],
    [t("archive.org"), links.archive_org],
  ].filter((l): l is [string, string] => !!l[1])

  return (
    <Sheet open={olid !== null && !gone} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        {olid !== null && (
          <>
            <SheetHeader className="border-b">
              <div className="flex gap-4">
                <div className="aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-md bg-muted sm:w-32">
                  {(q.data?.cover_url_large || book?.cover_url) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.data?.cover_url_large || book?.cover_url || ""} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 space-y-2 pr-6">
                  <SheetTitle className="leading-snug">{book?.title ?? <Skeleton className="h-5 w-48" />}</SheetTitle>
                  <SheetDescription className="line-clamp-3">{book?.authors?.join(", ")}</SheetDescription>
                  {book?.year != null && <p className="text-sm text-muted-foreground">{book.year}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {book?.is_new && <Badge variant="secondary" className="bg-green-100 text-green-800">{t("New")}</Badge>}
                    {book?.in_library && <Badge>{t("In library")}</Badge>}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              {q.isLoading && (
                <div className="space-y-3" role="status" aria-label={t("Loading")}>
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
                </div>
              )}

              {q.isError && !gone && <ErrorNotice error={q.error} onRetry={() => q.refetch()} texts={{ unreachable: "Open Library did not answer. Try again in a moment." }} />}

              {q.data && !loaded && (
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {t("More details unavailable right now")}
                  <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>{t("Try again")}</Button>
                </p>
              )}

              {q.data && (
                <>
                  <dl className="divide-y">
                    <Row label={t("Publisher")}>{q.data.publisher}</Row>
                    <Row label={t("Published")}>{q.data.publish_date}</Row>
                    <Row label={t("Pages")}>{q.data.pages}</Row>
                    <Row label={t("ISBN")}>{q.data.isbn}</Row>
                    <Row label={t("Languages")}>{q.data.languages.length > 0 ? q.data.languages.map(languageName).join(", ") : null}</Row>
                    <Row label={t("Size")}>{sizeOf(q.data.size)}</Row>
                    <Row label={t("Added to the archive")}>{dateOf(q.data.added_at)}</Row>
                    <Row label={t("Source")}>{t("Standard Ebooks via archive.org")}</Row>
                  </dl>

                  {q.data.description && <Description text={q.data.description} />}

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
              )}
            </div>

            <SheetFooter className="border-t">
              <Button onClick={() => onAdd(olid)} disabled={!!book?.in_library || busy}>
                {busy && <Spinner className="mr-2" aria-hidden />}
                {book?.in_library ? t("Already in your library") : busy ? t("Adding…") : t("Add to my library")}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
