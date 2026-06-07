"use client"

import { useState, useEffect, useCallback, useTransition, Suspense } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { z } from "zod"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { AdminLoan, PaginatedAdminLoans, PaginatedAdminLoansSchema, ApiError } from "@/types/api"
import { Loader2, Search, Calendar, User, BookOpen, RefreshCw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { ErrorState } from "@/components/ErrorState"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { useTranslation } from "react-i18next"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

function LoansPageContent() {
    const { t } = useTranslation()
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

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
        <div className="flex flex-col h-full p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">{t("Active Loans")}</h2>
                    <p className="text-muted-foreground">{t("Manage active book checkouts across all patrons.")}</p>
                </div>
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

                <Button variant="outline" onClick={() => refetch()} disabled={isRefetching || isLoading || isPending}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                    {t("Refresh")}
                </Button>
            </div>

            <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                <div className="flex-1 overflow-x-auto relative">
                    {isLoading && !pageData && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    )}
                    <Table>
                        <TableHeader className="bg-muted/50 border-b">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">{t("Patron")}</TableHead>
                                <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">{t("Book Title")}</TableHead>
                                <TableHead 
                                    className="font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors"
                                    onClick={() => handleSort("borrowed_at")}
                                >
                                    {t("Borrowed")} <SortIcon column="borrowed_at" />
                                </TableHead>
                                <TableHead 
                                    className="font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors"
                                    onClick={() => handleSort("due_at")}
                                >
                                    {t("Due")} <SortIcon column="due_at" />
                                </TableHead>
                                <TableHead 
                                    className="font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors"
                                    onClick={() => handleSort("returned_at")}
                                >
                                    {t("Returned")} <SortIcon column="returned_at" />
                                </TableHead>
                                <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right">{t("Status")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className={isRefetching || isPending ? "opacity-50 transition-opacity" : ""}>
                            {items.length === 0 && !isLoading ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={6} className="py-24 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center">
                                            <Search className="w-10 h-10 text-muted-foreground/30 mb-4" />
                                            <p className="text-lg font-medium">{t("No loans match these filters.")}</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                items.map(loan => (
                                    <TableRow key={loan.id}>
                                        <TableCell>
                                            <div 
                                                className="flex items-center gap-2 cursor-pointer group"
                                                onClick={() => updateUrlParams({ user: loan.user_identifier ?? null, offset: 0 })}
                                                title={t("Anonymous patron identifier (hashed). Click to filter.")}
                                            >
                                                <User className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                <span className="font-mono text-xs font-semibold text-foreground/80 group-hover:text-primary transition-colors">{loan.user_identifier}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-medium truncate max-w-[220px]" title={loan.book_title || loan.edition_key || undefined}>{loan.book_title || loan.edition_key}</span>
                                                    {!loan.book_title && loan.edition_key && (
                                                        <span className="text-[10px] uppercase text-muted-foreground font-mono">{t("Edition ID")}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                                {loan.borrowed_at ? new Date(loan.borrowed_at).toLocaleDateString() : "—"}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm font-medium">
                                                {loan.due_at ? new Date(loan.due_at).toLocaleDateString() : <span className="text-muted-foreground font-normal">{t("No expiry")}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm">
                                                {loan.returned_at ? new Date(loan.returned_at).toLocaleDateString() : "—"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                                                loan.status === 'overdue' ? 'bg-red-500/10 text-red-700 dark:text-red-400' :
                                                loan.status === 'returned' ? 'bg-muted text-muted-foreground' :
                                                'bg-green-500/10 text-green-700 dark:text-green-400'
                                            }`}>
                                                {t(loan.status)}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
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
