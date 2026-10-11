"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Loader2, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useCatalog, useCollections, useLoadBooks, useLoadProgress } from "@/hooks/preload/use-preload"
import { MAX_LISTED_IDS, formatSize, parseBookList, type PreloadBook, type PreloadImportResult } from "@/types/preload"

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

function BookTile({ book, selected, onToggle }: { book: PreloadBook; selected: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  const owned = book.in_library
  return (
    <li>
      <button
        type="button"
        disabled={owned}
        aria-pressed={selected}
        onClick={onToggle}
        className={`group relative flex h-full w-full flex-col gap-2 rounded-xl border p-2 text-left transition-colors enabled:hover:bg-muted/50 disabled:opacity-70 ${selected ? "border-primary ring-2 ring-primary" : ""}`}
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-muted">
          {book.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
          {owned && <Badge className="absolute left-2 top-2">{t("In library")}</Badge>}
          {selected && (
            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-4 w-4" aria-hidden />
            </span>
          )}
        </div>
        <span className="line-clamp-2 min-h-10 text-sm font-semibold leading-tight">{book.title}</span>
        <span className="line-clamp-1 text-xs text-muted-foreground">
          {[book.authors.join(", "), book.year].filter(Boolean).join(" · ")}
        </span>
      </button>
    </li>
  )
}

export function FreeBooks() {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const q = useDebounced(search)
  const [collection, setCollection] = useState("")
  const [hideOwned, setHideOwned] = useState(false)
  const [picked, setPicked] = useState<Map<number, PreloadBook>>(new Map())
  const [list, setList] = useState("")
  const [listResult, setListResult] = useState<PreloadImportResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const catalog = useCatalog({ q, collection, hideOwned })
  const collections = useCollections().data?.collections ?? []
  const load = useLoadBooks()
  const [since, setSince] = useState<number | null>(null)
  const progress = useLoadProgress(since)

  const books = useMemo(() => catalog.data?.pages.flatMap((p) => p.books) ?? [], [catalog.data])
  const head = catalog.data?.pages[0]
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
    setMessage(null)
    const startedAt = Date.now()
    try {
      const res = await load.mutateAsync(body)
      // Count from when the server accepted a load; keep the first start across chunked requests.
      setSince((s) => s ?? startedAt)
      return res
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("Something went wrong."))
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
    <div className="space-y-5">
      <p className="text-lg font-semibold">
        {head
          ? t("{{n}} free books available · {{lib}} in your library", { n: head.available, lib: head.in_library })
          : t("Free books")}
      </p>

      {message && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{message}</p>}

      {(progress.jobs.length > 0) && (
        <section aria-live="polite" className="space-y-2 rounded-xl border p-4">
          <p className="flex items-center gap-2 font-semibold">
            {running && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {running
              ? t("Adding books: {{done}} done, {{active}} to go", { done: progress.done, active: progress.active })
              : t("{{n}} books added", { n: progress.done })}
          </p>
          {progress.failed.length > 0 && (
            <div className="space-y-2 text-sm">
              <p className="text-red-700">{t("{{n}} failed", { n: progress.failed.length })}</p>
              <ul className="list-inside list-disc text-muted-foreground">
                {progress.failed.slice(0, 5).map((j) => (
                  <li key={j.olid}>{j.title ?? `OL${j.olid}M`}{j.error ? `: ${j.error}` : ""}</li>
                ))}
              </ul>
              <Button size="sm" variant="outline" disabled={load.isPending || running} onClick={retryFailed}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("Retry failed")}
              </Button>
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("Collections")}>
        <Button size="sm" variant={collection === "" ? "default" : "outline"} aria-pressed={collection === ""} onClick={() => setCollection("")}>
          {t("All")}
        </Button>
        {collections.map((c) => (
          <Button key={c.id} size="sm" variant={collection === c.id ? "default" : "outline"} aria-pressed={collection === c.id} onClick={() => setCollection(c.id)}>
            {c.name} <span className="ml-1 tabular-nums opacity-80">{c.count}</span>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Search title, author or subject")} aria-label={t("Search title, author or subject")} className="max-w-sm" />
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <Checkbox checked={hideOwned} onCheckedChange={(c) => setHideOwned(c === true)} />
          {t("Not in my library")}
        </label>
        {selectable.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Map([...picked, ...selectable.map((b) => [b.olid, b] as const)]))}>
            {t("Select all shown")}
          </Button>
        )}
        {current && (
          <Button size="sm" variant="outline" disabled={running || load.isPending} onClick={() => run({ collection })}>
            {t("Add all of {{name}}", { name: current.name })}
          </Button>
        )}
      </div>

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
      {catalog.isError && (
        <div role="alert" className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{(catalog.error as Error).message || t("Open Library did not answer.")}</p>
          <Button size="sm" variant="outline" onClick={() => catalog.refetch()}>{t("Try again")}</Button>
        </div>
      )}
      {catalog.isSuccess && books.length === 0 && <p className="rounded-xl border p-8 text-center text-muted-foreground">{t("No books match.")}</p>}

      {books.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {books.map((b) => <BookTile key={b.olid} book={b} selected={picked.has(b.olid)} onToggle={() => toggle(b)} />)}
        </ul>
      )}
      {catalog.hasNextPage && (
        <div className="text-center">
          <Button variant="outline" disabled={catalog.isFetchingNextPage} onClick={() => catalog.fetchNextPage()}>
            {catalog.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("Show more")}
          </Button>
        </div>
      )}

      <section className="space-y-2 rounded-xl border p-4">
        <label htmlFor="book-list" className="font-semibold">{t("Add a list")}</label>
        <p className="text-sm text-muted-foreground">{t("Paste Standard Ebooks ids or links, such as jane-austen/pride-and-prejudice. One per line or separated by commas.")}</p>
        <textarea
          id="book-list"
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
      </section>

      <div className="sticky bottom-0 -mx-2 flex flex-wrap items-center gap-2 border-t bg-background/95 px-2 py-3 backdrop-blur">
        <p className="mr-auto text-sm">
          {picked.size > 0 ? t("{{n}} selected", { n: picked.size }) : t("Pick books to add")}
        </p>
        {picked.size > 0 && <Button variant="ghost" onClick={() => setPicked(new Map())}>{t("Clear")}</Button>}
        <Button disabled={picked.size === 0 || load.isPending || running} onClick={addPicked}>
          {load.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {picked.size > 0
            ? t("Add {{n}} books · ~{{size}}", { n: picked.size, size: formatSize(bytes) })
            : t("Add books")}
        </Button>
      </div>
    </div>
  )
}
