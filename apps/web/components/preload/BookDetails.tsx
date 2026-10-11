"use client"

import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { ErrorNotice, errorKind } from "@/components/ErrorNotice"
import { usePreloadBook } from "@/hooks/preload/use-preload"
import { BookInfo } from "./BookInfo"

export { languageName } from "./BookInfo"
import type { PreloadBook, PreloadBookDetails } from "@/types/preload"

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
                  <BookInfo data={q.data} subjects={subjects} />
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
