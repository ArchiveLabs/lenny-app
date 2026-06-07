"use client"

import { useState, useMemo } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { BookOpen, Lock, Unlock, RefreshCw, Library, WifiOff, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardFooter } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { queryClient, LIBRARY_QUERY_KEY } from "@/lib/query-client"

import { LennyBook } from "@/types/api"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { parseItems } from "@/lib/library-utils"
import { BookCard, BookCardSkeleton } from "@/components/BookCard"
import { ErrorState } from "@/components/ErrorState"
import { useTranslation } from "react-i18next"

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

// Only used when free-text search is active
async function fetchAllBooks(): Promise<LennyBook[]> {
  const res = await fetchAdmin(`items?limit=500`)
  return handleApiResponse<Record<string, any>>(res).then(parseItems)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("all")
  const [browsePage, setBrowsePage] = useState(1)
  const [searchPage, setSearchPage] = useState(1)

  const q = query.toLowerCase().trim()
  const isSearching = q.length > 0

  // Paginated query — includes server-side filter; changes to filter/page fetch a fresh page
  const pageQuery = useQuery({
    queryKey: [...LIBRARY_QUERY_KEY, "page", browsePage, accessFilter] as const,
    queryFn: () => fetchPage(browsePage, accessFilter),
    enabled: !isSearching,
    placeholderData: keepPreviousData,
  })

  // Full fetch — only when free-text search is active; cached after first use
  const allQuery = useQuery({
    queryKey: [...LIBRARY_QUERY_KEY, "all"] as const,
    queryFn: fetchAllBooks,
    enabled: isSearching,
  })

  const isLoading = isSearching ? allQuery.isLoading : pageQuery.isLoading
  const isFetching = isSearching ? allQuery.isFetching : pageQuery.isFetching
  const activeError = isSearching ? (allQuery.error ?? pageQuery.error) : pageQuery.error

  // Search filters client-side on top of access filter
  const searchFiltered = useMemo(() => {
    if (!allQuery.data) return null
    return allQuery.data.filter(b => {
        const matchesQuery =
          b.title.toLowerCase().includes(q) ||
          b.author_name.some(a => a.toLowerCase().includes(q)) ||
          b.olid.toLowerCase().includes(q)
        const matchesAccess =
          accessFilter === "all" ||
          (accessFilter === "encrypted" && b.lenny.encrypted) ||
          (accessFilter === "open" && !b.lenny.encrypted)
        return matchesQuery && matchesAccess
      })
  }, [allQuery.data, q, accessFilter])

  const searchTotalPages = searchFiltered ? Math.max(1, Math.ceil(searchFiltered.length / PAGE_SIZE)) : 1
  const searchBooks = searchFiltered?.slice((searchPage - 1) * PAGE_SIZE, searchPage * PAGE_SIZE) ?? []

  const rawBrowseBooks = pageQuery.data ?? []
  const hasMore = rawBrowseBooks.length > PAGE_SIZE
  const browseBooks = hasMore ? rawBrowseBooks.slice(0, PAGE_SIZE) : rawBrowseBooks

  const displayBooks = isSearching ? searchBooks : browseBooks

  const handleQueryChange = (v: string) => { setQuery(v); setSearchPage(1) }
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
      await allQuery.refetch()
    } else {
      await pageQuery.refetch()
    }
  }

  return (
    <div className="flex flex-col h-full space-y-10 p-2 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">{t("Lenny Library")}</h2>
          <p className="text-muted-foreground text-base max-w-2xl">
            {t("All books currently available in this Lenny instance, enriched with OpenLibrary metadata.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9 w-[220px] rounded-lg"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
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
      ) : isSearching && searchFiltered !== null && searchFiltered.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <Search className="w-16 h-16 text-muted-foreground/20 mb-6" />
          <h3 className="text-xl font-bold mb-2">{t('No results for "{{query}}"', { query })}</h3>
          <p className="text-muted-foreground text-sm">{t("Try a different title, author, or edition ID.")}</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {displayBooks.map((book) => <BookCard key={book.olid} book={book} />)}
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
              <span className="text-sm font-medium text-muted-foreground w-16 text-center">
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

          {/* Search pagination (client-side) */}
          {isSearching && searchTotalPages > 1 && (
            <div className="flex items-center justify-center gap-6 pb-10">
              <Button
                variant="outline"
                className="font-semibold shadow-sm transition-transform hover:scale-[1.02]"
                disabled={searchPage <= 1}
                onClick={() => setSearchPage(p => p - 1)}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                {t("Previous")}
              </Button>
              <span className="text-sm font-medium text-muted-foreground w-28 text-center">
                {t("Page {{page}} of {{totalPages}}", { page: searchPage, totalPages: searchTotalPages })}
              </span>
              <Button
                variant="outline"
                className="font-semibold shadow-sm transition-transform hover:scale-[1.02]"
                disabled={searchPage >= searchTotalPages}
                onClick={() => setSearchPage(p => p + 1)}
              >
                {t("Next")}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
