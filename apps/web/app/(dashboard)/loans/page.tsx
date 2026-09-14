"use client"

import { useState, useEffect, useCallback, useTransition, Suspense } from "react"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { z } from "zod"
import { toast } from "sonner"
import { fetchAdmin, handleApiResponse, getApiBase } from "@/lib/api-client"
import { fetchAllLibraryItems, fetchItemSearch, sameEdition } from "@/lib/library-utils"
import { LIBRARY_QUERY_KEY } from "@/lib/query-client"
import { AdminItemSearchResult, AdminLoan, ApiError, CreateLoanResponse, CreateLoanResponseSchema, LennyBook, PaginatedAdminLoans, PaginatedAdminLoansSchema } from "@/types/api"
import { Loader2, Search, Calendar, User, BookOpen, RefreshCw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Undo2, Plus, Copy, CheckCircle2, Clock, AlertTriangle } from "lucide-react"
import { ErrorState } from "@/components/ErrorState"
import { BookEditSheet } from "@/components/BookEditSheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
    SheetTrigger,
} from "@workspace/ui/components/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { useTranslation } from "react-i18next"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

function CreateLoanSheet() {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    const [selectedBook, setSelectedBook] = useState<AdminItemSearchResult | null>(null)
    const [email, setEmail] = useState("")
    const [created, setCreated] = useState<CreateLoanResponse | null>(null)
    const [copied, setCopied] = useState(false)

    const reset = () => {
        setQuery("")
        setDebouncedQuery("")
        setSelectedBook(null)
        setEmail("")
        setCreated(null)
        setCopied(false)
    }

    useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(query.trim()), 300)
        return () => clearTimeout(id)
    }, [query])

    const bookSearch = useQuery({
        queryKey: ["admin-item-search", debouncedQuery],
        queryFn: () => fetchItemSearch(debouncedQuery),
        enabled: debouncedQuery.length > 0 && !selectedBook,
        placeholderData: keepPreviousData,
    })

    const editionDigits = selectedBook?.edition_key.replace(/\D/g, "") ?? ""

    const createLoan = useMutation({
        mutationFn: async () => {
            const res = await fetchAdmin("loans", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    openlibrary_edition: Number(editionDigits),
                    email: email.trim(),
                }),
            })
            return handleApiResponse<CreateLoanResponse>(res, CreateLoanResponseSchema)
        },
        onSuccess: (data) => {
            toast.success(t("Loan created"))
            queryClient.invalidateQueries({ queryKey: ["admin-loans"] })
            setCreated(data)
        },
        onError: (err: ApiError) => {
            toast.error(err?.message || t("Failed to create loan"))
        },
    })

    const emailValid = /\S+@\S+\.\S+/.test(email.trim())
    const canSubmit = editionDigits.length > 0 && emailValid
    const shareLink = created ? `${getApiBase()}/v1/api/items/${created.openlibrary_edition}/borrow` : ""

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareLink)
            setCopied(true)
            toast.success(t("Link copied"))
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error(t("Couldn't copy — copy it manually"))
        }
    }

    return (
        <Sheet open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset() }}>
            <SheetTrigger asChild>
                <Button className="font-semibold shadow-sm">
                    <Plus className="w-4 h-4 mr-2" />
                    {t("Create Loan")}
                </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>{t("Create Loan")}</SheetTitle>
                    <SheetDescription>{t("Lend a book from your library to a patron by email.")}</SheetDescription>
                </SheetHeader>

                {created ? (
                    <div className="flex-1 overflow-y-auto px-4 space-y-5">
                        <div className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900/40 px-4 py-3 text-sm text-green-700 dark:text-green-400">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>
                                {created.due_date
                                    ? t("Loan created — due {{date}}.", { date: new Date(created.due_date).toLocaleDateString() })
                                    : t("Loan created.")}
                            </span>
                        </div>

                        <div className="space-y-2">
                            <Label>{t("Share with the patron")}</Label>
                            <p className="text-xs text-muted-foreground">
                                {t("This link logs the patron in (if needed) and takes them straight to the book. Paste it into whatever email, Slack, or text you use to reach them.")}
                            </p>
                            <div className="flex gap-2">
                                <Input readOnly value={shareLink} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                                <Button type="button" variant="outline" className="shrink-0" onClick={copyLink}>
                                    {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto px-4 space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="book-search">{t("Book")}</Label>
                            {selectedBook ? (
                                <div className="flex items-start justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2.5">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{selectedBook.title}</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {selectedBook.author || t("Unknown author")} · {selectedBook.edition_key}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="shrink-0"
                                        onClick={() => { setSelectedBook(null); setQuery(""); setDebouncedQuery("") }}
                                    >
                                        {t("Change")}
                                    </Button>
                                </div>
                            ) : (
                                <div>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            id="book-search"
                                            placeholder={t("Search by title, author, or edition key…")}
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            autoComplete="off"
                                            spellCheck={false}
                                            className="pl-9"
                                        />
                                    </div>
                                    {debouncedQuery.length > 0 && (
                                        <div className="mt-1.5 max-h-64 overflow-y-auto rounded-lg border divide-y">
                                            {bookSearch.isLoading ? (
                                                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    {t("Searching…")}
                                                </div>
                                            ) : bookSearch.isError || bookSearch.data?.ol_unavailable ? (
                                                <div className="px-3 py-3 text-sm text-destructive">
                                                    {t("Search temporarily unavailable — try again.")}
                                                </div>
                                            ) : bookSearch.data && bookSearch.data.items.length > 0 ? (
                                                bookSearch.data.items.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => { setSelectedBook(item); setQuery(""); setDebouncedQuery("") }}
                                                        className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors"
                                                    >
                                                        <p className="text-sm font-medium truncate">{item.title}</p>
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {item.author || t("Unknown author")} · {item.edition_key}
                                                        </p>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-3 py-3 text-sm text-muted-foreground">
                                                    {t("No matches.")}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                                {t("Search your library, then pick the edition to lend.")}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="patron-email">{t("Patron email")}</Label>
                            <Input
                                id="patron-email"
                                type="email"
                                placeholder="reader@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                {t("The patron logs in with this same email — no separate invite needed.")}
                            </p>
                        </div>
                    </div>
                )}

                <SheetFooter>
                    {created ? (
                        <Button className="w-full font-semibold" onClick={() => setOpen(false)}>
                            {t("Done")}
                        </Button>
                    ) : (
                        <Button
                            className="w-full font-semibold"
                            disabled={!canSubmit || createLoan.isPending}
                            onClick={() => createLoan.mutate()}
                        >
                            {createLoan.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {t("Create Loan")}
                        </Button>
                    )}
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}

function LoanStatusBadge({ status }: { status: AdminLoan["status"] }) {
    const { t } = useTranslation()
    if (status === "overdue") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                <AlertTriangle className="h-3 w-3" />
                {t("Overdue")}
            </span>
        )
    }
    if (status === "returned") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" />
                {t("Returned")}
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">
            <Clock className="h-3 w-3" />
            {t("Active")}
        </span>
    )
}

// Opens the same full book-detail sheet used on the Library page, when we can
// resolve this loan's edition key to a known book. Falls back to plain text.
function LoanBookTitle({ loan, book, className }: { loan: AdminLoan; book?: LennyBook; className?: string }) {
    const { t } = useTranslation()
    const text = loan.book_title || loan.edition_key || "—"
    if (!book) {
        return <span className={className} title={loan.book_title || loan.edition_key || undefined}>{text}</span>
    }
    return (
        <BookEditSheet book={book}>
            <span
                className={`${className ?? ""} cursor-pointer underline-offset-2 hover:text-primary hover:underline transition-colors`}
                title={t("View full book details")}
            >
                {text}
            </span>
        </BookEditSheet>
    )
}

function LoansPageContent() {
    const { t } = useTranslation()
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const queryClient = useQueryClient()
    const [returningId, setReturningId] = useState<number | null>(null)

    // Shared with the Library page's own search fetch — lets a loan row's book
    // title open the same full book detail sheet, without a second endpoint.
    const { data: libraryBooks } = useQuery({
        queryKey: [...LIBRARY_QUERY_KEY, "all"] as const,
        queryFn: fetchAllLibraryItems,
        staleTime: 5 * 60_000,
    })
    const findBookByEdition = (editionKey: string | null | undefined): LennyBook | undefined =>
        libraryBooks?.find(b => sameEdition(b.olid, editionKey))

    const returnLoan = useMutation({
        mutationFn: async (loanId: number) => {
            const res = await fetchAdmin(`loans/${loanId}/return`, { method: "POST" })
            return handleApiResponse(res)
        },
        onMutate: (loanId) => setReturningId(loanId),
        onSuccess: () => {
            toast.success(t("Loan marked as returned"))
            queryClient.invalidateQueries({ queryKey: ["admin-loans"] })
        },
        onError: (err: ApiError) => {
            toast.error(err?.message || t("Failed to return loan"))
        },
        onSettled: () => setReturningId(null),
    })

    const statusParam = searchParams?.get("status") || "all"
    const userParam = searchParams?.get("user") || ""
    const sortParam = searchParams?.get("sort") || "borrowed_at"
    const orderParam = searchParams?.get("order") || "desc"
    const limitParam = parseInt(searchParams?.get("limit") || "50", 10)
    const offsetParam = parseInt(searchParams?.get("offset") || "0", 10)

    const [searchInput, setSearchInput] = useState(userParam)
    const [isPending, startTransition] = useTransition()

    // Sync input with URL if it changes externally
    useEffect(() => {
        setSearchInput(userParam)
    }, [userParam])

    // Update URL helper
    const updateUrlParams = useCallback((updates: Record<string, string | number | null>) => {
        const params = new URLSearchParams(searchParams?.toString())
        for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === "") {
                params.delete(key)
            } else {
                params.set(key, String(value))
            }
        }
        startTransition(() => {
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        })
    }, [searchParams, pathname, router])

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput !== userParam) {
                updateUrlParams({ user: searchInput, offset: 0 })
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [searchInput, userParam, updateUrlParams])

    const handleSearchInput = (val: string) => {
        // Strip non-hex characters and limit to 64
        const hexOnly = val.replace(/[^0-9a-fA-F]/g, '').toLowerCase().substring(0, 64)
        setSearchInput(hexOnly)
    }

    const { data: pageData, isLoading, isError, error, refetch, isRefetching } = useQuery({
        queryKey: ["admin-loans", { status: statusParam, user: userParam, sort: sortParam, order: orderParam, limit: limitParam, offset: offsetParam }],
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams({
                paginated: "true",
                limit: limitParam.toString(),
                offset: offsetParam.toString(),
                sort: sortParam,
                order: orderParam
            })
            if (statusParam && statusParam !== "all") params.set("status", statusParam)
            if (userParam) params.set("user", userParam)

            const res = await fetchAdmin(`loans?${params.toString()}`, { signal })
            
            if (res.ok) {
                const clone = res.clone()
                try {
                    const json = await clone.json()
                    if (Array.isArray(json)) {
                        console.warn("Backend returned legacy array instead of paginated object. Polyfilling.")
                        return {
                            items: json,
                            total: json.length,
                            limit: limitParam,
                            offset: 0
                        } as unknown as PaginatedAdminLoans
                    }
                } catch (e) {
                    console.error("Polyfill parsing failed:", e)
                    // Ignore JSON parsing errors here, let handleApiResponse deal with it
                }
            }

            return handleApiResponse<PaginatedAdminLoans>(res, PaginatedAdminLoansSchema)
        },
        placeholderData: keepPreviousData,
    })

    // This endpoint can be very slow intermittently — after a few seconds, say so
    // explicitly instead of leaving a bare spinner that reads as a frozen page.
    const [slowLoad, setSlowLoad] = useState(false)
    useEffect(() => {
        if (!isLoading || pageData) {
            setSlowLoad(false)
            return
        }
        const timer = setTimeout(() => setSlowLoad(true), 4000)
        return () => clearTimeout(timer)
    }, [isLoading, pageData])

    const handleSort = (column: string) => {
        if (sortParam === column) {
            updateUrlParams({ order: orderParam === "asc" ? "desc" : "asc", offset: 0 })
        } else {
            updateUrlParams({ sort: column, order: "desc", offset: 0 })
        }
    }

    const SortIcon = ({ column }: { column: string }) => {
        if (sortParam !== column) return null
        return orderParam === "asc" ? <ChevronUp className="w-3.5 h-3.5 ml-1 inline" /> : <ChevronDown className="w-3.5 h-3.5 ml-1 inline" />
    }

    const getErrorMessage = () => {
        if (error instanceof ApiError) {
            if (error.status === 400) return error.message
            if (error.status === 403) return t("Session expired — please sign in again.")
            if (error.status && error.status >= 500) return t("A server error occurred. Please try again.")
            if (error.message.includes("Invalid API response format") || error.message.includes("<html") || error.message.includes("Unexpected token")) {
                return t("Received an unexpected response from the server.")
            }
            return error.message
        }
        return t("Failed to load active loans. Please check your connection.")
    }

    if (isError && error instanceof ApiError && error.status === 403) {
        return <ErrorState message={t("Session expired — please sign in again.")} />
    }

    if (isError && !pageData) {
        return <ErrorState message={getErrorMessage()} retry={refetch} />
    }

    const total = pageData?.total || 0
    const items = pageData?.items || []
    
    // Pagination logic
    const showingFrom = total === 0 ? 0 : offsetParam + 1
    const showingTo = Math.min(total, offsetParam + limitParam)

    return (
        <div className="flex flex-col h-full p-2 md:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">{t("Active Loans")}</h2>
                    <p className="text-muted-foreground">{t("Manage active book checkouts across all patrons.")}</p>
                </div>
                <CreateLoanSheet />
            </div>

            <div className="flex flex-wrap items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
                <div className="flex-1 min-w-[240px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder={t("Search patron hex ID...")}
                        className="pl-9 bg-background"
                        value={searchInput}
                        onChange={(e) => handleSearchInput(e.target.value)}
                    />
                </div>
                
                <Select value={statusParam} onValueChange={(val) => updateUrlParams({ status: val, offset: 0 })}>
                    <SelectTrigger className="w-[160px] bg-background">
                        <SelectValue placeholder={t("Status")} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{t("All Statuses")}</SelectItem>
                        <SelectItem value="active">{t("Active")}</SelectItem>
                        <SelectItem value="overdue">{t("Overdue")}</SelectItem>
                        <SelectItem value="returned">{t("Returned")}</SelectItem>
                    </SelectContent>
                </Select>

                <Button
                    variant="outline"
                    onClick={async () => {
                        const result = await refetch()
                        if (result.error) {
                            toast.error(result.error instanceof ApiError ? result.error.message : t("Refresh failed"))
                        } else {
                            toast.success(t("Refreshed"))
                        }
                    }}
                    disabled={isRefetching || isLoading || isPending}
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                    {t("Refresh")}
                </Button>
            </div>

            <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                {/* Desktop / tablet: table */}
                <div className="hidden md:block flex-1 overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/50 border-b">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="pl-4 whitespace-nowrap font-semibold text-muted-foreground text-xs uppercase tracking-wider">{t("Patron")}</TableHead>
                                <TableHead className="w-full font-semibold text-muted-foreground text-xs uppercase tracking-wider">{t("Book Title")}</TableHead>
                                <TableHead
                                    className="whitespace-nowrap font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors"
                                    onClick={() => handleSort("borrowed_at")}
                                >
                                    {t("Borrowed")} <SortIcon column="borrowed_at" />
                                </TableHead>
                                <TableHead
                                    className="whitespace-nowrap font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors"
                                    onClick={() => handleSort("due_at")}
                                >
                                    {t("Due")} <SortIcon column="due_at" />
                                </TableHead>
                                <TableHead
                                    className="hidden lg:table-cell whitespace-nowrap font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors"
                                    onClick={() => handleSort("returned_at")}
                                >
                                    {t("Returned")} <SortIcon column="returned_at" />
                                </TableHead>
                                <TableHead className="whitespace-nowrap font-semibold text-muted-foreground text-xs uppercase tracking-wider">{t("Status")}</TableHead>
                                <TableHead className="pr-4 whitespace-nowrap font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right">{t("Actions")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className={isRefetching || isPending ? "opacity-50 transition-opacity" : ""}>
                            {isLoading && !pageData ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={7} className="py-24 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                                        {slowLoad && (
                                            <p className="mt-3 text-sm text-muted-foreground">
                                                {t("Still loading. This can take a while right now.")}
                                            </p>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ) : items.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={7} className="py-24 text-center">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <Search className="w-10 h-10 text-muted-foreground/30 mb-4" />
                                            <p className="text-lg font-medium text-foreground">{t("No active loans yet.")}</p>
                                            <p className="text-sm mt-1">{t("Loans a patron borrows, or one you create, will show up here.")}</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : items.map(loan => (
                                    <TableRow key={loan.id}>
                                        <TableCell className="pl-4 py-3">
                                            <div
                                                className="flex items-center gap-2 cursor-pointer group"
                                                onClick={() => updateUrlParams({ user: loan.user_identifier ?? null, offset: 0 })}
                                                title={t("Anonymous patron identifier (hashed). Click to filter.")}
                                            >
                                                <User className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                <span className="font-mono text-xs font-semibold text-foreground/80 group-hover:text-primary transition-colors">{loan.user_identifier}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <div className="flex flex-col min-w-0">
                                                    <LoanBookTitle loan={loan} book={findBookByEdition(loan.edition_key)} className="font-medium line-clamp-2 max-w-[280px]" />
                                                    {!loan.book_title && loan.edition_key && (
                                                        <span className="text-[10px] uppercase text-muted-foreground font-mono">{t("Edition ID")}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                                {loan.borrowed_at ? new Date(loan.borrowed_at).toLocaleDateString() : "—"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <div className="flex items-center gap-2 text-sm font-medium">
                                                {loan.due_at ? new Date(loan.due_at).toLocaleDateString() : <span className="text-muted-foreground font-normal">{t("No expiry")}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell py-3">
                                            <div className="flex items-center gap-2 text-sm">
                                                {loan.returned_at ? new Date(loan.returned_at).toLocaleDateString() : "—"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <LoanStatusBadge status={loan.status} />
                                        </TableCell>
                                        <TableCell className="pr-4 py-3 text-right">
                                            {loan.status !== "returned" ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 font-semibold"
                                                    disabled={returningId === loan.id}
                                                    onClick={() => returnLoan.mutate(loan.id)}
                                                >
                                                    {returningId === loan.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                                    ) : (
                                                        <Undo2 className="w-3.5 h-3.5 mr-1.5" />
                                                    )}
                                                    {t("Return")}
                                                </Button>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Phone: stacked cards */}
                    <div className={`md:hidden flex-1 overflow-y-auto divide-y divide-border ${isRefetching || isPending ? "opacity-50 transition-opacity" : ""}`}>
                        {isLoading && !pageData ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-24">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                {slowLoad && (
                                    <p className="text-sm text-muted-foreground text-center px-6">
                                        {t("Still loading. This can take a while right now.")}
                                    </p>
                                )}
                            </div>
                        ) : items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground px-6">
                                <Search className="w-10 h-10 text-muted-foreground/30 mb-4" />
                                <p className="text-lg font-medium text-foreground">{t("No active loans yet.")}</p>
                                <p className="text-sm mt-1">{t("Loans a patron borrows, or one you create, will show up here.")}</p>
                            </div>
                        ) : items.map(loan => (
                            <div key={loan.id} className="p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                                        <div className="min-w-0">
                                            <LoanBookTitle loan={loan} book={findBookByEdition(loan.edition_key)} className="font-medium text-sm line-clamp-2" />
                                            <button
                                                type="button"
                                                onClick={() => updateUrlParams({ user: loan.user_identifier ?? null, offset: 0 })}
                                                className="font-mono text-[11px] text-muted-foreground"
                                            >
                                                {loan.user_identifier}
                                            </button>
                                        </div>
                                    </div>
                                    <LoanStatusBadge status={loan.status} />
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                    <span className="inline-flex items-center gap-1.5">
                                        <Calendar className="w-3 h-3" />
                                        {t("Borrowed")} {loan.borrowed_at ? new Date(loan.borrowed_at).toLocaleDateString() : "—"}
                                    </span>
                                    <span>
                                        {t("Due")} {loan.due_at ? new Date(loan.due_at).toLocaleDateString() : t("No expiry")}
                                    </span>
                                    {loan.returned_at && (
                                        <span>{t("Returned")} {new Date(loan.returned_at).toLocaleDateString()}</span>
                                    )}
                                </div>

                                {loan.status !== "returned" && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 w-full font-semibold"
                                        disabled={returningId === loan.id}
                                        onClick={() => returnLoan.mutate(loan.id)}
                                    >
                                        {returningId === loan.id ? (
                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                        ) : (
                                            <Undo2 className="w-3.5 h-3.5 mr-1.5" />
                                        )}
                                        {t("Return")}
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>

                {/* Pagination Footer */}
                {total > 0 && (
                    <div className="border-t bg-muted/20 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{t("Rows per page:")}</span>
                            <Select value={limitParam.toString()} onValueChange={(val) => updateUrlParams({ limit: val, offset: 0 })}>
                                <SelectTrigger className="w-[70px] h-8 text-xs bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="flex items-center gap-6">
                            <span className="text-sm text-muted-foreground">
                                {t("Showing {{from}}–{{to}} of {{total}}", { from: showingFrom, to: showingTo, total })}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 w-8 p-0"
                                    onClick={() => updateUrlParams({ offset: Math.max(0, offsetParam - limitParam) })}
                                    disabled={offsetParam === 0 || isLoading}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 w-8 p-0"
                                    onClick={() => updateUrlParams({ offset: offsetParam + limitParam })}
                                    disabled={offsetParam + limitParam >= total || isLoading}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function LoansPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <LoansPageContent />
        </Suspense>
    )
}
