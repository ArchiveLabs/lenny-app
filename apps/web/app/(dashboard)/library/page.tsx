"use client"

import { useState, useEffect } from "react"
import { BookOpen, Lock, Unlock, RefreshCw, Library, WifiOff } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardFooter } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

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

// ── API URL resolution (same logic as use-upload-jobs) ───────────────────────

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

async function fetchLibrary(signal?: AbortSignal): Promise<LennyBook[]> {
  const res = await fetch(`${getApiBase()}/v1/api/items`, { signal })
  if (!res.ok) throw new Error(`Failed to fetch library: ${res.status}`)
  const data: Record<string, any> = await res.json()

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
              alt={book.title}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [books, setBooks] = useState<LennyBook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      setBooks(await fetchLibrary(signal))
    } catch (err: any) {
      if (err.name === "AbortError") return
      setError(err.message ?? "Failed to load library")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [])

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 space-y-10 p-2 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Lenny Library</h2>
          <p className="text-muted-foreground text-base max-w-2xl">
            All books currently available in this Lenny instance, enriched with OpenLibrary metadata.
          </p>
        </div>
        <Button variant="outline" className="font-semibold shadow-sm w-fit" onClick={() => load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {Array.from({ length: 10 }).map((_, i) => <BookCardSkeleton key={i} />)}
        </div>
      ) : error ? (
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
            {error}
          </div>
          <Button onClick={() => load()} className="font-semibold">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      ) : books.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <Library className="w-20 h-20 text-muted-foreground/20 mb-6" />
          <h3 className="text-2xl font-bold mb-2">No books yet</h3>
          <p className="text-muted-foreground">
            Upload EPUBs via the Upload page and they'll appear here once processed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pb-10">
          {books.map((book) => <BookCard key={book.olid} book={book} />)}
        </div>
      )}
    </div>
  )
}
