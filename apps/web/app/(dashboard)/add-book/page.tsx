"use client"
import { ReactNode, useState, useEffect, useRef } from "react"
import { Search, Book, BookOpen, Loader2, ExternalLink, ChevronLeft, ChevronRight, Plus, Check, Layers } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import Link from "next/link"
import { useBookQueue } from "@/hooks/use-book-queue"

import { BaseBookCard, BookCardSkeleton } from "@/components/BookCard"
import { useTranslation } from "react-i18next"

function SearchResultDetail({
  book,
  editionKey,
  coverUrl,
  queued,
  onQueue,
  onUnqueue,
  t,
  children,
}: {
  book: any
  editionKey: string | null
  coverUrl: string | null
  queued: boolean
  onQueue: () => void
  onUnqueue: () => void
  t: (key: string, options?: any) => string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <div className="cursor-pointer">{children}</div>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-start gap-3">
            <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-muted/50">
              {coverUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={coverUrl} alt={`${book.title} cover`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <BookOpen className="h-5 w-5 text-muted-foreground/30" />
                </div>
              )}
            </div>
            <div className="min-w-0 pt-0.5">
              <SheetTitle className="line-clamp-2 text-left">{book.title}</SheetTitle>
              <SheetDescription className="line-clamp-1 text-left">
                {book.author_name ? book.author_name.join(", ") : t("Unknown Author")}
              </SheetDescription>
              {editionKey && (
                <span className="mt-1.5 inline-block rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {editionKey}
                </span>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-4">
          {book.first_sentence?.[0] && (
            <p className="rounded-lg border bg-muted/20 p-3 text-sm italic leading-relaxed text-muted-foreground">
              “{book.first_sentence[0]}”
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("Publish Year")}</p>
              <p className="text-sm font-bold">{book.first_publish_year || t("Unknown")}</p>
            </div>
            {typeof book.edition_count === "number" && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("Editions")}</p>
                <p className="text-sm font-bold">{book.edition_count}</p>
              </div>
            )}
            {typeof book.ratings_average === "number" && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("Rating")}</p>
                <p className="text-sm font-bold">
                  {book.ratings_average.toFixed(1)}
                  <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                    ({t("{{count}} ratings", { count: book.ratings_count ?? 0 })})
                  </span>
                </p>
              </div>
            )}
            {Array.isArray(book.language) && book.language.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("Language")}</p>
                <p className="text-sm font-bold uppercase">{book.language.slice(0, 3).join(", ")}</p>
              </div>
            )}
            {editionKey && (
              <a
                href={`https://openlibrary.org/books/${editionKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col justify-center rounded-lg border bg-muted/30 p-3 text-primary transition-colors hover:border-primary/40"
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                  {t("Open Library")}
                  <ExternalLink className="h-3 w-3" />
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">{t("View full record")}</span>
              </a>
            )}
          </div>

          {Array.isArray(book.subject) && book.subject.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("Subjects")}</p>
              <div className="flex flex-wrap gap-1.5">
                {book.subject.slice(0, 8).map((s: string) => (
                  <span key={s} className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {editionKey && (
          <SheetFooter>
            {queued ? (
              <Button variant="outline" className="w-full font-semibold" onClick={onUnqueue}>
                <Check className="mr-2 h-4 w-4 text-green-500" />
                {t("Queued — tap to remove")}
              </Button>
            ) : (
              <Button className="w-full font-semibold" onClick={onQueue}>
                <Plus className="mr-2 h-4 w-4" />
                {t("Queue Book")}
              </Button>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}

export default function AddBookPage() {
    const { t } = useTranslation()
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<any[]>([])
    const [searchError, setSearchError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const { queue, addBook, removeBook } = useBookQueue()
    const searchAbortRef = useRef<AbortController | null>(null)

    const executeSearch = async (pageNum: number, searchQuery: string = query) => {
        if (!searchQuery.trim()) {
            setResults([])
            setSearched(false)
            return
        }
        // Cancel any in-flight request
        searchAbortRef.current?.abort()
        searchAbortRef.current = new AbortController()

        setLoading(true)
        setSearchError(null)
        if (pageNum === 1) setSearched(true)
        try {
            // Using limit=24 as a comfortable over-fetch buffer to account for filtering invalid editions
            const res = await fetch(
                `https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery.trim())}&limit=24&page=${pageNum}`,
                { signal: searchAbortRef.current.signal }
            )
            if (res.status === 422) {
                // OpenLibrary rejects the query semantically — treat as no results
                setResults([])
                setTotalPages(1)
                return
            }
            if (!res.ok) {
                setSearchError(t("Open Library returned an error ({{status}}). Try again.", { status: res.status }))
                setResults([])
                setTotalPages(1)
                return
            }
            const data = await res.json()
            const docs = data.docs || []
            const validDocs = docs.filter((book: any) => book.cover_edition_key || (book.edition_key && book.edition_key.length > 0))
            setResults(validDocs)
            setTotalPages(Math.max(1, Math.ceil((data.numFound || 0) / 24)))
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return
            setSearchError(t("Could not reach Open Library. Check your connection and try again."))
            setResults([])
            setTotalPages(1)
        } finally {
            setLoading(false)
        }
    }

    // Debounce auto-search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim()) {
                setPage(1)
                executeSearch(1, query)
            } else {
                setResults([])
                setSearched(false)
                setSearchError(null)
            }
        }, 600)
        
        return () => clearTimeout(timer)
    }, [query])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (!query.trim()) return
        setPage(1)
        executeSearch(1, query)
    }

    const handlePageChange = (newPage: number) => {
        setPage(newPage)
        executeSearch(newPage)
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 space-y-10 p-2 md:p-6 lg:p-8">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex flex-col space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">{t("Open Library Registry")}</h2>
                    <p className="text-muted-foreground text-base max-w-2xl">
                        {t("Search the official Open Library registry to instantly grab metadata Edition IDs for your EPUB uploads.")}
                    </p>
                </div>
                <Button variant="outline" className="font-semibold shadow-sm w-fit group" asChild>
                    <a href="https://openlibrary.org/books/add" target="_blank" rel="noopener noreferrer">
                        <Plus className="mr-2 h-4 w-4" />
                        {t("Add Book Data")}
                        <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </a>
                </Button>
            </div>

            {/* Search Bar Section */}
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row sm:items-center gap-3 w-full max-w-3xl relative">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <Input
                        aria-label={t("Search by title, author, or ISBN")}
                        className="pl-12 h-12 sm:h-14 bg-background border-muted-foreground/30 text-base sm:text-lg shadow-sm focus-visible:ring-primary/40 rounded-xl"
                        placeholder={t("Search by title, author, or ISBN...")}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                <Button type="submit" disabled={loading} size="lg" className="h-12 sm:h-14 px-8 rounded-xl font-bold shadow-sm hover:scale-[1.02] transition-transform text-base sm:text-lg">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : t("Search")}
                </Button>
            </form>

            {/* Results Section */}
            <div className="flex-1 pb-10">
                {searchError ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto gap-3">
                        <p className="text-sm font-medium text-destructive">{searchError}</p>
                    </div>
                ) : loading && results.length === 0 ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <BookCardSkeleton key={i} />
                        ))}
                    </div>
                ) : (
                    <div className={`grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 transition-opacity duration-200 ${loading ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
                        {results.map((book, idx) => {
                            const editionKey = book.cover_edition_key || (book.edition_key ? book.edition_key[0] : null)
                            const coverUrl = book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : null
                            
                            const isQueued = editionKey ? queue.some(q => q.editionKey === editionKey) : false
                            const queueThisBook = () => editionKey && addBook({ editionKey, title: book.title, author: book.author_name ? book.author_name.join(", ") : t("Unknown Author"), year: book.first_publish_year, coverUrl: coverUrl || "", addedAt: Date.now() })
                            const unqueueThisBook = () => editionKey && removeBook(editionKey)

                            return (
                                <SearchResultDetail
                                    key={editionKey ?? idx}
                                    book={book}
                                    editionKey={editionKey}
                                    coverUrl={coverUrl}
                                    queued={isQueued}
                                    onQueue={queueThisBook}
                                    onUnqueue={unqueueThisBook}
                                    t={t}
                                >
                                  <BaseBookCard
                                    title={book.title}
                                    author={book.author_name ? book.author_name.join(", ") : t("Unknown Author")}
                                    coverUrl={coverUrl}
                                    idBadge={editionKey}
                                    contentMiddle={
                                      editionKey && (
                                          <a
                                              href={`https://openlibrary.org/books/${editionKey}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-primary/60 transition-colors hover:text-primary hover:underline"
                                          >
                                              <span className="truncate">{t("View on OL")}</span>
                                              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                          </a>
                                      )
                                    }
                                    footer={
                                      <>
                                          <div className="flex flex-col">
                                              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-0.5">{t("Publish Year")}</span>
                                              <span className="text-xs font-bold text-foreground/80">{book.first_publish_year || t("Unknown")}</span>
                                          </div>

                                          {editionKey && (
                                              isQueued ? (
                                                  <Button
                                                      variant="ghost"
                                                      onClick={(e) => { e.stopPropagation(); unqueueThisBook() }}
                                                      className="h-7 rounded-full px-3.5 text-[11px] font-bold shadow-sm border border-border bg-muted/30 transition-transform hover:scale-[1.04]"
                                                  >
                                                      <Check className="mr-1.5 h-3 w-3 text-green-500" />
                                                      {t("Queued")}
                                                  </Button>
                                              ) : (
                                                  <Button
                                                      onClick={(e) => { e.stopPropagation(); queueThisBook() }}
                                                      className="h-7 rounded-full px-3.5 text-[11px] font-bold shadow-sm transition-transform hover:scale-[1.04]"
                                                  >
                                                      <Plus className="mr-1 h-3 w-3" />
                                                      {t("Queue Book")}
                                                  </Button>
                                              )
                                          )}
                                      </>
                                    }
                                  />
                                </SearchResultDetail>
                            )
                        })}
                    </div>
                )}

                {/* Pagination Controls */}
                {searched && !loading && totalPages > 1 && (
                    <div className="mt-12 flex items-center justify-center gap-6">
                        <Button 
                            variant="outline" 
                            className="font-semibold shadow-sm transition-transform hover:scale-[1.02]"
                            disabled={page <= 1}
                            onClick={() => handlePageChange(page - 1)}
                        >
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            {t("Previous")}
                        </Button>
                        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                            {t("Page {{page}} of {{totalPages}}", { page, totalPages })}
                        </span>
                        <Button 
                            variant="outline" 
                            className="font-semibold shadow-sm transition-transform hover:scale-[1.02]"
                            disabled={page >= totalPages}
                            onClick={() => handlePageChange(page + 1)}
                        >
                            {t("Next")}
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                )}

                {searched && !loading && results.length === 0 && (
                    <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
                        <Book className="w-20 h-20 text-muted-foreground/20 mb-6" />
                        <h3 className="text-2xl font-bold mb-2">{t("No matching editions")}</h3>
                        <p className="text-muted-foreground">{t('Open Library couldn\'t find an exact match for "{{query}}". You may need to create the edition manually on their site.', { query })}</p>
                        <Button variant="outline" className="mt-8 rounded-xl font-semibold px-6" asChild>
                            <a href="https://openlibrary.org/books/add" target="_blank" rel="noopener noreferrer">
                                {t("Create Manually on OpenLibrary.org")}
                            </a>
                        </Button>
                    </div>
                )}

                {/* Sticky Queue Footer Notification */}
                {queue.length > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background pl-6 pr-2 py-2 rounded-full shadow-2xl flex items-center gap-6 z-50 animate-in fade-in slide-in-from-bottom-8">
                        <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 opacity-70" />
                            <span className="font-semibold text-[13px]">{queue.length === 1 ? t("1 Edition Queued") : t("{{count}} Editions Queued", { count: queue.length })}</span>
                        </div>
                        <Button variant="secondary" className="rounded-full px-5 h-8 text-xs font-bold shadow-sm transition-transform hover:scale-105" asChild>
                            <Link href="/">{t("Proceed to Upload")}</Link>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
