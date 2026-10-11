"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronRight, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { ErrorNotice, errorKind } from "@/components/ErrorNotice"
import { Notice } from "@/components/import/Notice"
import { BookDetails } from "./BookDetails"
import { EmptyPreload } from "./EmptyPreload"
import { ProgressPanel } from "@/components/import/ProgressPanel"
import { ApiError } from "@/types/api"
import { toast } from "sonner"
import { useCatalog, useCatalogRefresh, useCollections, useLoadBooks, useLoadProgress, type CatalogSort } from "@/hooks/preload/use-preload"
import { relativeTime } from "@/lib/preload/time"
import { MAX_LISTED_IDS, formatSize, parseBookList, type PreloadBook, type PreloadImportResult } from "@/types/preload"

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

const NEW_VIEW = "__new"
const SELECT = "h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
const SORT_KEY = "lenny-free-books-sort"
// Kept for the session only, and never required: a blocked store just means the default.
const readSort = (): CatalogSort => {
  try {
    return sessionStorage.getItem(SORT_KEY) === "added_desc" ? "added_desc" : "title"
  } catch {
    return "title"
  }
}
const writeSort = (v: CatalogSort) => {
  try {
    sessionStorage.setItem(SORT_KEY, v)
  } catch {
    // blocked storage
  }
}

function BookTile({ book, selected, selecting, onToggle, onOpen }: { book: PreloadBook; selected: boolean; selecting: boolean; onToggle: () => void; onOpen: () => void }) {
  const { t } = useTranslation()
  const owned = book.in_library
  return (
    <li className={`relative rounded-xl border transition-colors hover:bg-muted/50 ${selected ? "border-primary ring-2 ring-primary" : ""}`}>
      {/* A card opens the details. While selecting, it picks the book instead, and the checkbox shows what is picked. */}
      <button type="button" onClick={selecting && !owned ? onToggle : onOpen} className="flex h-full w-full flex-col gap-2 rounded-xl p-2 text-left">
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-muted">
          {book.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
          {owned && <Badge className="absolute left-2 top-2">{t("In library")}</Badge>}
          {book.is_new && (
            <Badge variant="secondary" className="absolute bottom-2 left-2 bg-green-100 text-green-800">{t("New")}</Badge>
          )}
        </div>
        <span className="line-clamp-2 min-h-10 text-sm font-semibold leading-tight">{book.title}</span>
        <span className="line-clamp-1 text-xs text-muted-foreground">
          {[book.authors.join(", "), book.year].filter(Boolean).join(" · ")}
        </span>
      </button>
      {selecting && !owned && (
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={t("Select {{name}}", { name: book.title })}
          className="absolute right-3 top-3 h-5 w-5 bg-background shadow-sm"
        />
      )}
    </li>
  )
}

export function FreeBooks() {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const q = useDebounced(search)
  const [collection, setCollection] = useState("")
  const [hideOwned, setHideOwned] = useState(false)
  const [newOnly, setNewOnly] = useState(false)
  const [selecting, setSelecting] = useState(false) // checkboxes only show while picking books to add
  const [viewing, setViewing] = useState<number | null>(null) // the book whose details are open
  const [sort, setSort] = useState<CatalogSort>(readSort)
  // One "Show" menu replaces the rows of chips: all books, the new ones, or a collection.
  const view = newOnly ? NEW_VIEW : collection
  const changeView = (v: string) => {
    setNewOnly(v === NEW_VIEW)
    setCollection(v === NEW_VIEW ? "" : v)
  }
  const changeSort = (v: CatalogSort) => {
    setSort(v)
    writeSort(v)
  }
  const [picked, setPicked] = useState<Map<number, PreloadBook>>(new Map())
  const [list, setList] = useState("")
  const [listResult, setListResult] = useState<PreloadImportResult | null>(null)
  const [runError, setRunError] = useState<unknown>(null)
  const [listOpen, setListOpen] = useState(false)
  const listBox = useRef<HTMLTextAreaElement>(null)

  const catalog = useCatalog({ q, collection, hideOwned, sort, newOnly })
  // No catalog on the server (a 404) is "nothing preloaded yet": offer ways to start rather than a bare error.
  const noCatalog = catalog.isError && errorKind(catalog.error) === "gone"
  const collections = useCollections().data?.collections ?? []
  const load = useLoadBooks()
  const [since, setSince] = useState<number | null>(null)
  const progress = useLoadProgress(since)

  const refreshing = useCatalogRefresh(catalog.refetch)
  const books = useMemo(() => catalog.data?.pages.flatMap((p) => p.books) ?? [], [catalog.data])
  const head = catalog.data?.pages[0]
  // Tell the admin when the list grew, once per increase (a refresh, or the catalog reloading on focus).
  const available = head?.available
  const seenAvailable = useRef<number | null>(null)
  useEffect(() => {
    if (available === undefined) return
    if (seenAvailable.current !== null && available > seenAvailable.current) {
      toast.info(t("{{n}} new books are available", { n: available - seenAvailable.current }))
    }
    seenAvailable.current = available
  }, [available, t])
  const checking = refreshing.checking || !!head?.refreshing
  const bytes = [...picked.values()].reduce((n, b) => n + (b.size ?? 0), 0)
  const selectable = books.filter((b) => !b.in_library)
  const running = progress.active > 0
  const current = collections.find((c) => c.id === collection)

  const toggle = (b: PreloadBook) =>
    setPicked((m) => {
      const next = new Map(m)
      if (!next.delete(b.olid)) next.set(b.olid, b)
      return next
    })

  const run = async (body: Parameters<typeof load.mutateAsync>[0]) => {
    setRunError(null)
    const startedAt = Date.now()
    try {
      const res = await load.mutateAsync(body)
      // Count from when the server accepted a load; keep the first start across chunked requests.
      setSince((s) => s ?? startedAt)
      return res
    } catch (e) {
      setRunError(e)
    }
  }

  const addPicked = async () => {
    const ids = [...picked.keys()]
    for (let i = 0; i < ids.length; i += MAX_LISTED_IDS) {
      const res = await run({ olids: ids.slice(i, i + MAX_LISTED_IDS) })
      if (!res) return // keep the selection so the admin can retry
    }
    setPicked(new Map())
  }

  const addList = async () => {
    const body = parseBookList(list)
    if (!body.olids && !body.source_ids) return
    const res = await run(body)
    if (res) {
      setListResult(res)
      setList("")
    }
  }

  const retryFailed = () => run({ olids: progress.failed.map((j) => j.olid) })

  return (
    <div className="space-y-4">
      {head && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <p>{t("{{n}} free books available · {{lib}} in your library", { n: head.available, lib: head.in_library })}</p>
          <span className="flex items-center gap-1">
            {checking ? (
              <>
                <Spinner className="h-3.5 w-3.5" role="presentation" aria-hidden />
                {t("Checking archive.org…")}
              </>
            ) : (
              head.updated_at && relativeTime(head.updated_at) && <span>{t("Updated {{when}}", { when: relativeTime(head.updated_at) })}</span>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              aria-label={t("Check for new books")}
              title={t("Check archive.org for new books")}
              disabled={checking}
              onClick={refreshing.refresh}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </span>
        </div>
      )}
      {refreshing.error != null && (
        <ErrorNotice boxed error={refreshing.error} onRetry={refreshing.refresh} texts={{ gone: "Checking for new books is not available right now.", unreachable: "archive.org did not answer. Try again in a moment." }} />
      )}

      {runError != null &&
        // A refusal such as "a load is already running" is the server explaining itself; anything else gets the shared wording.
        (runError instanceof ApiError && runError.status === 409 ? (
          <Notice tone="warning">{runError.message}</Notice>
        ) : (
          <ErrorNotice
            boxed
            error={runError}
            onRetry={() => setRunError(null)}
            retryOn={[]}
            texts={{ gone: "Books cannot be added right now. Try again in a moment.", unreachable: "Open Library did not answer. Try again in a moment." }}
          />
        ))}

      {running && (
        <ProgressPanel
          stages={[{
            key: "adding",
            label: t("Adding books: {{done}} done, {{active}} to go", { done: progress.done, active: progress.active }),
            done: progress.done,
            total: progress.done + progress.active,
          }]}
        />
      )}
      {!running && progress.jobs.length > 0 && progress.done > 0 && <Notice tone="success">{t("{{n}} books added", { n: progress.done })}</Notice>}
      {progress.failed.length > 0 && (
        <Notice
          tone="warning"
          action={
            <Button size="sm" variant="outline" disabled={load.isPending || running} onClick={retryFailed}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("Retry failed")}
            </Button>
          }
        >
          <span className="block font-medium">{t("{{n}} failed", { n: progress.failed.length })}</span>
          <ul className="list-inside list-disc text-xs">
            {progress.failed.slice(0, 5).map((j) => (
              <li key={j.olid}>{j.title ?? `OL${j.olid}M`}{j.error ? `: ${j.error}` : ""}</li>
            ))}
          </ul>
        </Notice>
      )}

      {!catalog.isError && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Search title, author or subject")}
            aria-label={t("Search title, author or subject")}
            className="h-9 w-full sm:w-64"
          />
          {(collections.length > 0 || (head?.new ?? 0) > 0) && (
            <select aria-label={t("Show")} value={view} onChange={(e) => changeView(e.target.value)} className={SELECT}>
              <option value="">{t("All books")}</option>
              {(head?.new ?? 0) > 0 && <option value={NEW_VIEW}>{t("New ({{n}})", { n: head!.new })}</option>}
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{`${c.name} (${c.count})`}</option>
              ))}
            </select>
          )}
          <select aria-label={t("Sort")} value={sort} onChange={(e) => changeSort(e.target.value as CatalogSort)} className={SELECT}>
            <option value="title">{t("A-Z")}</option>
            <option value="added_desc">{t("Newest first")}</option>
          </select>
          <label className="flex h-9 items-center gap-2 text-sm">
            <Checkbox checked={hideOwned} onCheckedChange={(c) => setHideOwned(c === true)} />
            {t("Not in my library")}
          </label>
        </div>
      )}

      {catalog.isLoading && (
        <div className="space-y-3" role="status">
          <p className="text-sm text-muted-foreground">
            {t("Loading the catalog from Open Library. The first load can take about 30 seconds.")}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3] rounded-xl" />)}
          </div>
        </div>
      )}
      {noCatalog && (
        <EmptyPreload
          browsing={catalog.isFetching}
          onBrowse={() => catalog.refetch()}
          onPasteList={() => {
            setListOpen(true)
            setTimeout(() => listBox.current?.focus(), 0)
          }}
        />
      )}
      {catalog.isError && !noCatalog && (
        <ErrorNotice
          boxed
          error={catalog.error}
          onRetry={() => catalog.refetch()}
          texts={{ unreachable: "Open Library did not answer. Try again in a moment." }}
        />
      )}
      {catalog.isSuccess && books.length === 0 && (
        <p className="rounded-xl border p-8 text-center text-muted-foreground">
          {newOnly ? t("Nothing new in the last 14 days") : t("No books match.")}
        </p>
      )}

      {!catalog.isError && (books.length > 0 || current) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">{t("{{n}} books shown", { n: books.length })}</p>
          <div className="flex items-center gap-1">
            {selecting ? (
              <>
                {selectable.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setPicked(new Map([...picked, ...selectable.map((b) => [b.olid, b] as const)]))}>
                    {t("Select all shown")}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => { setSelecting(false); setPicked(new Map()) }}>{t("Cancel")}</Button>
              </>
            ) : (
              <>
                {selectable.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setSelecting(true)}>{t("Select books")}</Button>
                )}
                {current && (
                  <Button size="sm" variant="outline" disabled={running || load.isPending} onClick={() => run({ collection })}>
                    {t("Add all of {{name}}", { name: current.name })}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {books.length > 0 && (
        <ul
          className={`grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-4 lg:grid-cols-6 ${catalog.isPlaceholderData ? "opacity-60" : ""}`}
          aria-busy={catalog.isPlaceholderData}
        >
          {books.map((b) => <BookTile key={b.olid} book={b} selected={picked.has(b.olid)} selecting={selecting} onToggle={() => toggle(b)} onOpen={() => setViewing(b.olid)} />)}
        </ul>
      )}
      {catalog.hasNextPage && (
        <div className="text-center">
          <Button variant="outline" disabled={catalog.isFetchingNextPage} onClick={() => catalog.fetchNextPage()}>
            {catalog.isFetchingNextPage && <Spinner className="mr-2" aria-hidden />}
            {t("Show more")}
          </Button>
        </div>
      )}

      <details className="group rounded-xl border" open={listOpen} onToggle={(e) => setListOpen(e.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-semibold">
          <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden />
          {t("Add a list of books")}
        </summary>
        <div className="space-y-2 px-4 pb-4">
          <label htmlFor="book-list" className="text-sm font-medium">{t("Add a list")}</label>
          <p className="text-sm text-muted-foreground">{t("Paste Standard Ebooks ids or links, such as jane-austen/pride-and-prejudice. One per line or separated by commas.")}</p>
          <textarea
            id="book-list"
            ref={listBox}
            value={list}
            onChange={(e) => setList(e.target.value)}
            rows={4}
            spellCheck={false}
            className="w-full rounded-lg border bg-background p-3 font-mono text-sm"
          />
          <Button variant="outline" disabled={!list.trim() || load.isPending || running} onClick={addList}>{t("Add list")}</Button>
          {listResult && (
            <p role="status" className="text-sm">
              {t("{{queued}} queued, {{owned}} already in your library, {{unknown}} not found", {
                queued: listResult.queued, owned: listResult.already_in_library, unknown: listResult.unknown.length,
              })}
              {listResult.unknown.length > 0 && <span className="block text-muted-foreground">{listResult.unknown.join(", ")}</span>}
            </p>
          )}
        </div>
      </details>

      {picked.size > 0 && (
      <div className="sticky bottom-0 -mx-2 flex flex-wrap items-center gap-2 border-t bg-background/95 px-2 py-3 backdrop-blur">
        <p className="mr-auto text-sm">{t("{{n}} selected", { n: picked.size })}</p>
        <Button variant="ghost" onClick={() => setPicked(new Map())}>{t("Clear")}</Button>
        <Button disabled={picked.size === 0 || load.isPending || running} onClick={addPicked}>
          {load.isPending && <Spinner className="mr-2" aria-hidden />}
          {t("Add {{n}} books · ~{{size}}", { n: picked.size, size: formatSize(bytes) })}
        </Button>
      </div>
      )}
      <BookDetails
        olid={viewing}
        listed={books.find((b) => b.olid === viewing)}
        busy={load.isPending || running}
        onAdd={(olid) => run({ olids: [olid] })}
        onClose={() => setViewing(null)}
        onGone={() => {
          setViewing(null)
          catalog.refetch()
        }}
      />
    </div>
  )
}
