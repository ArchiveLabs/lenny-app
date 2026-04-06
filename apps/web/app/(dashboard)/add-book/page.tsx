"use client"
import { useState, useEffect, useRef } from "react"
import { Search, Book, Loader2, Link as LinkIcon, ExternalLink, ChevronLeft, ChevronRight, Plus, Check, Layers } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import Link from "next/link"
import { useBookQueue } from "@/hooks/use-book-queue"

function BookCardSkeleton() {
    return (
        <div className="flex flex-col overflow-hidden rounded-lg border border-border/50 bg-card">
            <div className="relative h-48 w-full bg-muted/30 p-4 flex items-center justify-center">
                <Skeleton className="h-full w-[100px]" />
                <Skeleton className="absolute left-3 top-3 h-5 w-20 rounded-md" />
            </div>
            <div className="flex flex-1 flex-col px-4 pt-4 pb-3 gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/3 mt-1" />
                <div className="mt-auto pt-4 flex items-end justify-between">
                    <div className="flex flex-col gap-1">
                        <Skeleton className="h-2 w-16" />
                        <Skeleton className="h-3 w-10" />
                    </div>
                    <Skeleton className="h-7 w-24 rounded-full" />
                </div>
            </div>
        </div>
    )
}

export default function AddBookPage() {
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
                setSearchError(`Open Library returned an error (${res.status}). Try again.`)
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
            setSearchError("Could not reach Open Library. Check your connection and try again.")
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
                    <h2 className="text-3xl font-bold tracking-tight">Open Library Registry</h2>
                    <p className="text-muted-foreground text-base max-w-2xl">
                        Search the official Open Library registry to instantly grab metadata Edition IDs for your EPUB uploads.
                    </p>
                </div>
                <Button variant="outline" className="font-semibold shadow-sm w-fit group" asChild>
                    <a href="https://openlibrary.org/books/add" target="_blank" rel="noopener noreferrer">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Book Data
                        <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </a>
                </Button>
            </div>

            {/* Search Bar Section */}
            <form onSubmit={handleSearch} className="flex items-center gap-3 w-full max-w-3xl relative">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <Input
                        aria-label="Search by title, author, or ISBN"
                        className="pl-12 h-14 bg-background border-muted-foreground/30 text-lg shadow-sm focus-visible:ring-primary/40 rounded-xl"
                        placeholder="Search by title, author, or ISBN..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                <Button type="submit" disabled={loading} size="lg" className="h-14 px-8 rounded-xl font-bold shadow-sm hover:scale-[1.02] transition-transform text-lg">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Search"}
                </Button>
            </form>

            {/* Results Section */}
            <div className="flex-1 pb-10">
                {searchError ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto gap-3">
                        <p className="text-sm font-medium text-destructive">{searchError}</p>
                    </div>
                ) : loading && results.length === 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <BookCardSkeleton key={i} />
                        ))}
                    </div>
                ) : (
                    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 transition-opacity duration-200 ${loading ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
                        {results.map((book, idx) => {
                            const editionKey = book.cover_edition_key || (book.edition_key ? book.edition_key[0] : null)
                            const coverUrl = book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : ""
                            
                            return (
                                <Card key={editionKey ?? idx} className="group relative flex flex-col overflow-hidden border border-border/50 bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40">
                                    <div className="relative h-48 w-full overflow-hidden bg-gradient-to-b from-muted/40 to-muted/10 p-4 flex items-center justify-center">
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
                                                <Book className="h-8 w-8 text-muted-foreground/20 transition-transform duration-300 group-hover:scale-110 group-hover:text-primary/40" />
                                                <span className="text-[11px] font-medium text-muted-foreground/50">No Cover Art Available</span>
                                            </div>
                                        )}
                                        
                                        {/* Fixed Edition ID Tag */}
                                        {editionKey && (
                                            <div className="absolute left-3 top-3 z-20 flex items-center rounded-md border border-border/50 bg-background/95 px-2 py-1 text-[11px] font-bold text-foreground shadow-sm backdrop-blur-md">
                                                {editionKey}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-1 flex-col px-4 pt-4 pb-3">
                                        <h3 className="mb-1 line-clamp-2 text-[15px] font-bold leading-snug tracking-tight group-hover:text-primary transition-colors duration-200">
                                            {book.title}
                                        </h3>
                                        <p className="line-clamp-1 text-[13px] font-medium text-muted-foreground">
                                            {book.author_name ? book.author_name.join(", ") : "Unknown Author"}
                                        </p>

                                        {editionKey && (
                                            <a 
                                                href={`https://openlibrary.org/books/${editionKey}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary/60 transition-colors hover:text-primary hover:underline"
                                            >
                                                View it in Open Library
                                                <ExternalLink className="h-2.5 w-2.5" />
                                            </a>
                                        )}
                                        
                                        <div className="mt-auto pt-4 flex items-end justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-0.5">Publish Year</span>
                                                <span className="text-xs font-bold text-foreground/80">{book.first_publish_year || "Unknown"}</span>
                                            </div>
                                            
                                            {editionKey && (
                                                queue.some(q => q.editionKey === editionKey) ? (
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() => removeBook(editionKey)}
                                                        className="h-7 rounded-full px-3.5 text-[11px] font-bold shadow-sm border border-border bg-muted/30 transition-transform hover:scale-[1.04]"
                                                    >
                                                        <Check className="mr-1.5 h-3 w-3 text-green-500" />
                                                        Queued
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        onClick={() => addBook({ editionKey, title: book.title, author: book.author_name ? book.author_name.join(", ") : "Unknown Author", year: book.first_publish_year, coverUrl, addedAt: Date.now() })}
                                                        className="h-7 rounded-full px-3.5 text-[11px] font-bold shadow-sm transition-transform hover:scale-[1.04]"
                                                    >
                                                        <Plus className="mr-1 h-3 w-3" />
                                                        Queue Book
                                                    </Button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </Card>
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
                            Previous
                        </Button>
                        <span className="text-sm font-medium text-muted-foreground w-24 text-center">
                            Page {page} of {totalPages}
                        </span>
                        <Button 
                            variant="outline" 
                            className="font-semibold shadow-sm transition-transform hover:scale-[1.02]"
                            disabled={page >= totalPages}
                            onClick={() => handlePageChange(page + 1)}
                        >
                            Next
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                )}

                {searched && !loading && results.length === 0 && (
                    <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
                        <Book className="w-20 h-20 text-muted-foreground/20 mb-6" />
                        <h3 className="text-2xl font-bold mb-2">No matching editions</h3>
                        <p className="text-muted-foreground">Open Library couldn't find an exact match for "{query}". You may need to create the edition manually on their site.</p>
                        <Button variant="outline" className="mt-8 rounded-xl font-semibold px-6" asChild>
                            <a href="https://openlibrary.org/books/add" target="_blank" rel="noopener noreferrer">
                                Create Manually on OpenLibrary.org
                            </a>
                        </Button>
                    </div>
                )}

                {/* Sticky Queue Footer Notification */}
                {queue.length > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background pl-6 pr-2 py-2 rounded-full shadow-2xl flex items-center gap-6 z-50 animate-in fade-in slide-in-from-bottom-8">
                        <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 opacity-70" />
                            <span className="font-semibold text-[13px]">{queue.length} Edition{queue.length !== 1 && "s"} Queued</span>
                        </div>
                        <Button variant="secondary" className="rounded-full px-5 h-8 text-xs font-bold shadow-sm transition-transform hover:scale-105" asChild>
                            <Link href="/">Proceed to Upload</Link>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
