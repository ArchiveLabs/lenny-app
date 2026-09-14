"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query"
import { toast } from "sonner"
import { BookOpen, Lock, Unlock, RefreshCw, Library, WifiOff, ChevronLeft, ChevronRight, Search, Trash2, Loader2, XCircle, AlertCircle, ListChecks, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardFooter } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { queryClient, LIBRARY_QUERY_KEY, removeBooksFromLibraryCache } from "@/lib/query-client"

import { AdminItemSearchResponse, AdminItemSearchResponseSchema, ApiError, BulkDeleteResponse, BulkDeleteResponseSchema, LennyBook } from "@/types/api"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { fetchAllLibraryItems, parseItems, sameEdition } from "@/lib/library-utils"
import { BookCard, BookCardSkeleton } from "@/components/BookCard"
import { ErrorState } from "@/components/ErrorState"
import { useTranslation } from "react-i18next"

const DELETE_BATCH_SIZE = 200

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Data fetching ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

type AccessFilter = "all" | "open" | "encrypted"

async function fetchPage(page: number, accessFilter: AccessFilter): Promise<LennyBook[]> {
  const offset = (page - 1) * PAGE_SIZE
  // Fetch one extra item to detect if there's a next page (avoids empty last-page navigation)
  const params = new URLSearchParams({ limit: String(PAGE_SIZE + 1), offset: String(offset) })
  if (accessFilter === "encrypted") params.set("encrypted", "true")
  if (accessFilter === "open") params.set("encrypted", "false")
  const res = await fetchAdmin(`items?${params}`)
  return handleApiResponse<Record<string, any>>(res).then(parseItems)
}

const SEARCH_LIMIT = 40

async function fetchSearchResults(q: string, accessFilter: AccessFilter): Promise<AdminItemSearchResponse> {
  const params = new URLSearchParams({ q, limit: String(SEARCH_LIMIT) })
  if (accessFilter === "encrypted") params.set("encrypted", "true")
  if (accessFilter === "open") params.set("encrypted", "false")
  const res = await fetchAdmin(`items/search?${params}`)
  return handleApiResponse<AdminItemSearchResponse>(res, AdminItemSearchResponseSchema)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("all")
  const [browsePage, setBrowsePage] = useState(1)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Map<string, LennyBook>>(new Map())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [results, setResults] = useState<BulkDeleteResponse | null>(null)

  const exitSelectMode = () => { setSelectMode(false); setSelected(new Map()) }

  // Debounce the search box — it now hits a live server endpoint per keystroke otherwise
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350)
    return () => clearTimeout(timer)
  }, [query])

  const isSearching = debouncedQuery.length > 0

  // Paginated query — includes server-side filter; changes to filter/page fetch a fresh page.
  // /admin/items is slow (multi-second), so don't silently refetch just because the tab
  // regained focus or the page remounted — only an explicit Refresh or a real mutation
  // (upload/edit/delete, which invalidate this cache directly) should trigger a new call.
  const pageQuery = useQuery({
    queryKey: [...LIBRARY_QUERY_KEY, "page", browsePage, accessFilter] as const,
    queryFn: () => fetchPage(browsePage, accessFilter),
    enabled: !isSearching,
    placeholderData: keepPreviousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  // Live search — GET /admin/items/search, no local filtering. Bounded "best matches",
  // not a paged listing: no sort, no offset, results come back in OL's relevance order.
  const searchQuery = useQuery({
    queryKey: [...LIBRARY_QUERY_KEY, "search", debouncedQuery, accessFilter] as const,
    queryFn: () => fetchSearchResults(debouncedQuery, accessFilter),
    enabled: isSearching,
  })

  // Full item list, only fetched while searching — used purely to resolve a lean search
  // result into the full record (cover, copies, loan-duration override) before opening
  // its edit sheet, so Save never operates on guessed data. Cheap now (server-cached).
  const fullItemsQuery = useQuery({
    queryKey: [...LIBRARY_QUERY_KEY, "all"] as const,
    queryFn: fetchAllLibraryItems,
    enabled: isSearching,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  const isLoading = isSearching ? (searchQuery.isLoading || fullItemsQuery.isLoading) : pageQuery.isLoading
  const isFetching = isSearching ? (searchQuery.isFetching || fullItemsQuery.isFetching) : pageQuery.isFetching
  const activeError = isSearching ? (searchQuery.error ?? fullItemsQuery.error) : pageQuery.error

  // Resolve each lean search result to its full record; skip any we can't resolve yet
  // rather than render a card with guessed/missing data.
  const searchBooks = useMemo(() => {
    if (!searchQuery.data || !fullItemsQuery.data) return []
    return searchQuery.data.items
      .map(result => fullItemsQuery.data!.find(b => sameEdition(b.olid, result.edition_key)))
      .filter((b): b is LennyBook => !!b)
  }, [searchQuery.data, fullItemsQuery.data])

  const searchHitLimit = (searchQuery.data?.items.length ?? 0) >= SEARCH_LIMIT

  const rawBrowseBooks = pageQuery.data ?? []
  const hasMore = rawBrowseBooks.length > PAGE_SIZE
  const browseBooks = hasMore ? rawBrowseBooks.slice(0, PAGE_SIZE) : rawBrowseBooks

  const displayBooks = isSearching ? searchBooks : browseBooks

  const toggleSelect = (book: LennyBook, checked: boolean) => {
    setSelected(prev => {
      const next = new Map(prev)
      if (checked) next.set(book.olid, book)
      else next.delete(book.olid)
      return next
    })
  }
  const allOnPageSelected = displayBooks.length > 0 && displayBooks.every(b => selected.has(b.olid))
  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelected(prev => {
      const next = new Map(prev)
      if (checked) displayBooks.forEach(b => next.set(b.olid, b))
      else displayBooks.forEach(b => next.delete(b.olid))
      return next
    })
  }

  const bulkDelete = useMutation({
    mutationFn: async (books: LennyBook[]) => {
      const batches = chunk(books.map(b => b.olid), DELETE_BATCH_SIZE)
      const combined: BulkDeleteResponse = { deleted: [], not_found: [], failed: {}, invalid: [] }
      for (const batch of batches) {
        const res = await fetchAdmin("items/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ book_ids: batch }),
        })
        const parsed = await handleApiResponse<BulkDeleteResponse>(res, BulkDeleteResponseSchema)
        combined.deleted.push(...parsed.deleted)
        combined.not_found.push(...parsed.not_found)
        combined.invalid.push(...parsed.invalid)
        Object.assign(combined.failed, parsed.failed)
      }
      return combined
    },
    onSuccess: (data) => {
      // The response already tells us exactly which books were actually deleted —
      // remove just those from the cached list instead of a slow round-trip refetch.
      removeBooksFromLibraryCache(data.deleted)
      setSelected(new Map())
      setSelectMode(false)
      setResults(data)
    },
    onError: (err: ApiError) => {
      toast.error(err?.message || t("Bulk delete failed"))
      // Some books in the batch may have actually been deleted before the error -
      // re-sync with the backend instead of leaving stale cached data on screen.
      queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY })
    },
  })

  const handleQueryChange = (v: string) => setQuery(v)
  const handleFilterChange = (v: string) => {
    const newFilter = v as AccessFilter
    // Invalidate the cache for the new filter so the global staleTime:Infinity
    // doesn't serve stale cached data when switching back to a previously-viewed filter
    queryClient.invalidateQueries({ queryKey: [...LIBRARY_QUERY_KEY, "page", 1, newFilter] })
    setAccessFilter(newFilter)
    setBrowsePage(1)
  }
  const handleRefetch = async () => {
    if (isSearching) {
      await Promise.all([searchQuery.refetch(), fullItemsQuery.refetch()])
    } else {
      await pageQuery.refetch()
    }
  }

  return (
    <div className="flex flex-col h-full space-y-10 p-2 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col space-y-2 min-w-0">
          <h2 className="text-3xl font-bold tracking-tight">{t("Lenny Library")}</h2>
          <p className="text-muted-foreground text-base max-w-2xl">
            {t("All books currently available in this Lenny instance, enriched with OpenLibrary metadata.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 w-full shrink-0 sm:w-auto">
          {selectMode ? (
            <>
              <label className="flex items-center gap-2 text-sm font-medium mr-1 cursor-pointer select-none">
                <Checkbox checked={allOnPageSelected} onCheckedChange={(c) => toggleSelectAllOnPage(!!c)} />
                {t("Select all ({{count}})", { count: displayBooks.length })}
              </label>
              <Button variant="ghost" className="font-semibold" onClick={exitSelectMode}>
                <X className="mr-2 h-4 w-4" />
                {t("Cancel")}
              </Button>
            </>
          ) : (
            displayBooks.length > 0 && (
              <Button variant="outline" className="font-semibold shadow-sm" onClick={() => setSelectMode(true)}>
                <ListChecks className="mr-2 h-4 w-4" />
                {t("Select")}
              </Button>
            )
          )}
          <Select value={accessFilter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-[150px] rounded-lg font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Books")}</SelectItem>
              <SelectItem value="open">{t("Open Access")}</SelectItem>
              <SelectItem value="encrypted">{t("Encrypted")}</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[140px] sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9 w-full sm:w-[220px] rounded-lg"
              placeholder={t("Search title, author, edition…")}
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
            />
          </div>

          <Button variant="outline" className="font-semibold shadow-sm" onClick={handleRefetch} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            {t("Refresh")}
          </Button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => <BookCardSkeleton key={i} />)}
        </div>
      ) : activeError ? (
        <ErrorState error={activeError as Error} onRetry={handleRefetch} />
      ) : !isSearching && browseBooks.length === 0 && browsePage === 1 ? (
        <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <Library className="w-20 h-20 text-muted-foreground/20 mb-6" />
          <h3 className="text-2xl font-bold mb-2">
            {accessFilter === "all" ? t("No books yet") : t("No books match this filter")}
          </h3>
          <p className="text-muted-foreground">
            {accessFilter === "all"
              ? t("Upload EPUBs via the Upload page and they'll appear here once processed.")
              : t('Try switching to "All Books" to see everything.')}
          </p>
        </div>
      ) : isSearching && !isFetching && searchBooks.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <Search className="w-16 h-16 text-muted-foreground/20 mb-6" />
          {searchQuery.data?.ol_unavailable ? (
            <>
              <h3 className="text-xl font-bold mb-2">{t("Search temporarily unavailable")}</h3>
              <p className="text-muted-foreground text-sm">{t("Open Library didn't respond — this isn't necessarily \"no matches\". Try again in a moment.")}</p>
            </>
          ) : (searchQuery.data?.items.length ?? 0) > 0 ? (
            <>
              <h3 className="text-xl font-bold mb-2">{t("Couldn't load full details for these matches")}</h3>
              <p className="text-muted-foreground text-sm">{t("Try refreshing — the results found them, but couldn't confirm their full record yet.")}</p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold mb-2">{t('No results for "{{query}}"', { query: debouncedQuery })}</h3>
              <p className="text-muted-foreground text-sm">{t("Try a different title, author, or edition ID.")}</p>
            </>
          )}
        </div>
      ) : (
        <>
        <div className="relative">
          {isFetching && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/5 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm font-medium text-muted-foreground animate-pulse">{t("Loading items…")}</span>
              </div>
            </div>
          )}
          <div className={`transition-opacity duration-300 ${isFetching ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
              {displayBooks.map((book) => (
                <BookCard
                  key={book.olid}
                  book={book}
                  selectMode={selectMode}
                  selected={selected.has(book.olid)}
                  onSelectChange={(c) => toggleSelect(book, c)}
                />
              ))}
            </div>
          </div>
        </div>

          {/* Browse pagination (server-side, includes filter) */}
          {!isSearching && (browsePage > 1 || hasMore) && (
            <div className="flex items-center justify-center gap-6 pb-10">
              <Button
                variant="outline"
                className="font-semibold shadow-sm transition-transform hover:scale-[1.02]"
                disabled={browsePage <= 1 || isFetching}
                onClick={() => setBrowsePage(p => p - 1)}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                {t("Previous")}
              </Button>
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                {t("Page {{page}}", { page: browsePage })}
              </span>
              <Button
                variant="outline"
                className="font-semibold shadow-sm transition-transform hover:scale-[1.02]"
                disabled={!hasMore || isFetching}
                onClick={() => setBrowsePage(p => p + 1)}
              >
                {t("Next")}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Live search has no real pagination — bounded "best matches", not a paged listing */}
          {isSearching && searchHitLimit && (
            <p className="text-center text-sm text-muted-foreground pb-10">
              {t("Showing the top {{limit}} matches — refine your search to narrow it down.", { limit: SEARCH_LIMIT })}
            </p>
          )}
        </>
      )}

      {/* Sticky selection bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background pl-6 pr-2 py-2 rounded-full shadow-2xl flex items-center gap-4 z-50 animate-in fade-in slide-in-from-bottom-8">
          <span className="font-semibold text-[13px]">
            {selected.size === 1 ? t("1 book selected") : t("{{count}} books selected", { count: selected.size })}
          </span>
          <Button variant="ghost" size="sm" className="h-8 text-background hover:bg-background/10 hover:text-background" onClick={() => setSelected(new Map())}>
            {t("Clear")}
          </Button>
          <Button variant="destructive" size="sm" className="rounded-full px-4 h-8 text-xs font-bold" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            {t("Delete Selected")}
          </Button>
        </div>
      )}

      {/* Confirm bulk delete */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("Delete {{count}} books?", { count: selected.size })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("This permanently removes each book's files and database record, and cancels any active loans on them. This cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-48 overflow-y-auto rounded-lg border bg-muted/30 p-2 space-y-1">
            {Array.from(selected.values()).map(b => (
              <p key={b.olid} className="text-sm truncate" title={b.title}>{b.title}</p>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={bulkDelete.isPending}
              onClick={() => { setConfirmOpen(false); bulkDelete.mutate(Array.from(selected.values())) }}
            >
              {bulkDelete.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("Delete Permanently")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete results */}
      <AlertDialog open={results !== null} onOpenChange={(open) => !open && setResults(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete results")}</AlertDialogTitle>
            <AlertDialogDescription>
              {results && t("{{deleted}} deleted, {{notFound}} not found, {{failed}} failed, {{invalid}} invalid.", {
                deleted: results.deleted.length,
                notFound: results.not_found.length,
                failed: Object.keys(results.failed).length,
                invalid: results.invalid.length,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {results && (results.not_found.length > 0 || Object.keys(results.failed).length > 0 || results.invalid.length > 0) && (
            <div className="max-h-56 overflow-y-auto space-y-3">
              {results.not_found.length > 0 && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <AlertCircle className="h-3.5 w-3.5" /> {t("Not found")}
                  </p>
                  <p className="text-sm text-muted-foreground font-mono break-all">{results.not_found.join(", ")}</p>
                </div>
              )}
              {Object.keys(results.failed).length > 0 && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                    <XCircle className="h-3.5 w-3.5" /> {t("Failed")}
                  </p>
                  {Object.entries(results.failed).map(([id, reason]) => (
                    <p key={id} className="text-sm">
                      <span className="font-mono text-muted-foreground">{id}</span>: {reason}
                    </p>
                  ))}
                </div>
              )}
              {results.invalid.length > 0 && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <AlertCircle className="h-3.5 w-3.5" /> {t("Invalid")}
                  </p>
                  <p className="text-sm text-muted-foreground font-mono break-all">{results.invalid.join(", ")}</p>
                </div>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setResults(null)}>{t("Close")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
