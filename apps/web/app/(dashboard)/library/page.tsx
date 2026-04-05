"use client"

import { useState } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { BookOpen, Lock, Unlock, RefreshCw, Library, WifiOff, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardFooter } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { queryClient, LIBRARY_QUERY_KEY } from "@/lib/query-client"

// ── Types ────────────────────────────────────────────────────────────────────

interface LennyRecord {
  id: number
  openlibrary_edition: number
  encrypted: boolean
  formats: string
  created_at: string
  updated_at: string
  is_borrowable: boolean
  is_readable: boolean
  is_lendable: boolean
  available_copies: number
}

interface LennyBook {
  olid: string            // e.g. "OL12345678M"
  title: string
  author_name: string[]
  cover_i?: number
  lenny: LennyRecord
}

// ── API URL resolution ───────────────────────────────────────────────────────

function getApiBase(): string {
  const envApi = process.env.NEXT_PUBLIC_API_URL
  if (envApi) {
    const isInternal = envApi.includes("lenny_api") || envApi.includes("127.0.0.1")
    if (!isInternal) return envApi
  }
  if (typeof window !== "undefined") {
    const { hostname } = window.location
    if (hostname === "localhost" || hostname === "127.0.0.1") return "http://localhost:8080"
    return window.location.origin
  }
  return "http://localhost:8080"
}

// ── Data fetching ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

function parseItems(data: Record<string, any>): LennyBook[] {
  return Object.entries(data)
    .filter(([, item]) => item.lenny != null)
    .map(([rawId, item]) => ({
      olid: `OL${rawId}M`,
      title: item.title ?? "Unknown Title",
      author_name: item.author_name ?? [],
      cover_i: item.editions?.docs?.[0]?.cover_i,
      lenny: item.lenny,
    }))
}

type AccessFilter = "all" | "open" | "encrypted"

async function fetchPage(page: number, accessFilter: AccessFilter): Promise<LennyBook[]> {
  const offset = (page - 1) * PAGE_SIZE
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
  if (accessFilter === "encrypted") params.set("encrypted", "true")
  if (accessFilter === "open") params.set("encrypted", "false")
  const res = await fetch(`${getApiBase()}/v1/api/items?${params}`)
  if (!res.ok) throw new Error(`Failed to fetch library: ${res.status}`)
  return parseItems(await res.json())
}

// Only used when free-text search is active
async function fetchAllBooks(): Promise<LennyBook[]> {
  const res = await fetch(`${getApiBase()}/v1/api/items?limit=500`)
  if (!res.ok) throw new Error(`Failed to fetch library: ${res.status}`)
  return parseItems(await res.json())
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FormatBadge({ formats }: { formats: string }) {
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

function BookCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border/50 bg-card">
      <div className="relative h-52 w-full bg-muted/30 p-4 flex items-center justify-center">
        <Skeleton className="h-full w-[110px]" />
        <Skeleton className="absolute left-3 top-3 h-5 w-20 rounded-md" />
      </div>
      <div className="flex flex-1 flex-col px-4 pt-4 pb-3 gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="mt-auto pt-4 flex items-end justify-between">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
    </div>
  )
}

function BookCard({ book }: { book: LennyBook }) {
  const coverUrl = book.cover_i
    ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
    : null
  const author = book.author_name.length > 0 ? book.author_name.join(", ") : "Unknown Author"

  return (
    <Card className="group relative flex flex-col overflow-hidden border border-border/50 bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40">
      {/* Cover */}
      <div className="relative h-52 w-full overflow-hidden bg-gradient-to-b from-muted/40 to-muted/10 p-4 flex items-center justify-center">
        {coverUrl ? (
          <>
            <div className="absolute inset-0 bg-background/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />
            <img
              src={coverUrl}
              alt={`${book.title} cover`}
              loading="lazy"
              decoding="async"
              className="relative z-0 h-full w-auto object-contain drop-shadow-xl transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </>
        ) : (
          <div className="relative z-0 flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/20 bg-muted/5 transition-colors group-hover:border-primary/20">
            <BookOpen className="h-8 w-8 text-muted-foreground/20 transition-transform duration-300 group-hover:scale-110 group-hover:text-primary/40" />
            <span className="text-[11px] font-medium text-muted-foreground/50">No Cover Art</span>
          </div>
        )}

        {/* Edition ID badge */}
        <div className="absolute left-3 top-3 z-20 flex items-center rounded-md border border-border/50 bg-background/95 px-2 py-1 text-[11px] font-bold text-foreground shadow-sm backdrop-blur-md">
          {book.olid}
        </div>

        {/* Encrypted indicator */}
        <div className="absolute right-3 top-3 z-20">
          {book.lenny.encrypted ? (
            <span className="flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              <Lock className="h-3 w-3" />
              DRM
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-md bg-green-500/10 border border-green-500/20 px-1.5 py-1 text-[10px] font-bold text-green-700 dark:text-green-400">
              <Unlock className="h-3 w-3" />
              Open
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <CardContent className="flex flex-1 flex-col px-4 pt-4 pb-0">
        <h3 className="mb-1 line-clamp-2 text-[15px] font-bold leading-snug tracking-tight group-hover:text-primary transition-colors duration-200">
          {book.title}
        </h3>
        <p className="line-clamp-1 text-[13px] font-medium text-muted-foreground">{author}</p>
      </CardContent>

      <CardFooter className="px-4 pt-3 pb-4 flex items-center justify-between">
        <FormatBadge formats={book.lenny.formats} />
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Copies</span>
          <span className="text-xs font-bold text-foreground/80">{book.lenny.available_copies}</span>
        </div>
      </CardFooter>
    </Card>
  )
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center max-w-lg mx-auto gap-6">
      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
        <WifiOff className="w-9 h-9 text-red-500/60" />
      </div>
      <div className="space-y-2">
        <h3 className="text-2xl font-bold">Lenny is unreachable</h3>
        <p className="text-muted-foreground text-base leading-relaxed">
          The admin UI couldn't connect to the Lenny backend. Make sure the FastAPI server is running and reachable.
        </p>
      </div>
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/40 px-4 py-2.5 text-sm font-mono text-red-700 dark:text-red-400 w-full text-left">
        {error.message}
      </div>
      <Button onClick={onRetry} className="font-semibold">
        <RefreshCw className="mr-2 h-4 w-4" />
        Try Again
      </Button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
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
  const searchFiltered = allQuery.data
    ? allQuery.data.filter(b => {
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
    : null

  const searchTotalPages = searchFiltered ? Math.max(1, Math.ceil(searchFiltered.length / PAGE_SIZE)) : 1
  const searchBooks = searchFiltered?.slice((searchPage - 1) * PAGE_SIZE, searchPage * PAGE_SIZE) ?? []

  const browseBooks = pageQuery.data ?? []
  const hasMore = browseBooks.length === PAGE_SIZE

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
          <h2 className="text-3xl font-bold tracking-tight">Lenny Library</h2>
          <p className="text-muted-foreground text-base max-w-2xl">
            All books currently available in this Lenny instance, enriched with OpenLibrary metadata.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={accessFilter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-[150px] rounded-lg font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Books</SelectItem>
              <SelectItem value="open">Open Access</SelectItem>
              <SelectItem value="encrypted">Encrypted</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9 w-[220px] rounded-lg"
              placeholder="Search title, author, edition…"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
            />
          </div>

          <Button variant="outline" className="font-semibold shadow-sm" onClick={handleRefetch} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
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
            {accessFilter === "all" ? "No books yet" : "No books match this filter"}
          </h3>
          <p className="text-muted-foreground">
            {accessFilter === "all"
              ? "Upload EPUBs via the Upload page and they'll appear here once processed."
              : "Try switching to \"All Books\" to see everything."}
          </p>
        </div>
      ) : isSearching && searchFiltered !== null && searchFiltered.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <Search className="w-16 h-16 text-muted-foreground/20 mb-6" />
          <h3 className="text-xl font-bold mb-2">No results for "{query}"</h3>
          <p className="text-muted-foreground text-sm">Try a different title, author, or edition ID.</p>
        </div>
      ) : (
        <>
        <div className="relative">
          {isFetching && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/5 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm font-medium text-muted-foreground animate-pulse">Loading items…</span>
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
                Previous
              </Button>
              <span className="text-sm font-medium text-muted-foreground w-16 text-center">
                Page {browsePage}
              </span>
              <Button
                variant="outline"
                className="font-semibold shadow-sm transition-transform hover:scale-[1.02]"
                disabled={!hasMore || isFetching}
                onClick={() => setBrowsePage(p => p + 1)}
              >
                Next
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
                Previous
              </Button>
              <span className="text-sm font-medium text-muted-foreground w-28 text-center">
                Page {searchPage} of {searchTotalPages}
              </span>
              <Button
                variant="outline"
                className="font-semibold shadow-sm transition-transform hover:scale-[1.02]"
                disabled={searchPage >= searchTotalPages}
                onClick={() => setSearchPage(p => p + 1)}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
