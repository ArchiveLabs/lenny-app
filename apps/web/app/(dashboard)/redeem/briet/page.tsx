"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { forceFreshLibraryOnNextVisit } from "@/lib/query-client"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Clock, Download, Loader2, Ticket, XCircle } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  ApiError,
  BrietRedeemResult,
  BrietRedeemResultSchema,
  ImportJob,
  ImportsResponse,
  ImportsResponseSchema,
} from "@/types/api"

/** Statuses the backend is still working on — the ones worth polling for. */
const IN_FLIGHT: ImportJob["status"][] = ["pending", "downloading"]

function ImportStatusBadge({ status, error }: { status: ImportJob["status"]; error?: string | null }) {
  const { t } = useTranslation()
  switch (status) {
    case "pending":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
          <Clock className="w-3 h-3" />
          {t("Queued")}
        </span>
      )
    case "downloading":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full">
          <Loader2 className="w-3 h-3 animate-spin" />
          {t("Downloading")}
        </span>
      )
    case "done":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full">
          <CheckCircle2 className="w-3 h-3" />
          {t("Done")}
        </span>
      )
    case "failed":
      return (
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full"
          title={error ?? undefined}
        >
          <XCircle className="w-3 h-3" />
          {t("Failed")}
        </span>
      )
  }
}

export default function BrietRedeemPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [code, setCode] = useState("")
  const [result, setResult] = useState<BrietRedeemResult | null>(null)
  // Redeeming only queues the job server-side — the ImportJob rows can take a
  // moment to appear, so keep polling for a bit after a redeem even if the
  // very next fetch still comes back empty, instead of giving up immediately.
  const [pollUntil, setPollUntil] = useState(0)

  // The redeem call only queues the books; the downloads happen in a backend
  // background task, so the table below is the real progress indicator.
  const { data } = useQuery({
    queryKey: ["imports"],
    queryFn: async () => {
      const res = await fetchAdmin("imports")
      return handleApiResponse<ImportsResponse>(res, ImportsResponseSchema)
    },
    refetchInterval: (query) => {
      const hasInFlight = query.state.data?.imports.some((job) => IN_FLIGHT.includes(job.status))
      return hasInFlight || Date.now() < pollUntil ? 2000 : false
    },
  })

  const imports = data?.imports ?? []

  const redeem = useMutation({
    mutationFn: async (redeemCode: string) => {
      const res = await fetchAdmin("briet/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: redeemCode }),
      })
      return handleApiResponse<BrietRedeemResult>(res, BrietRedeemResultSchema)
    },
    onSuccess: (redeemed) => {
      setResult(redeemed)
      setCode("")
      setPollUntil(Date.now() + 15000)
      queryClient.invalidateQueries({ queryKey: ["imports"] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return
    setResult(null)
    redeem.mutate(trimmed)
  }

  const error = redeem.error as ApiError | null

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 space-y-10 p-2 md:p-6 lg:p-8">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="w-fit -ml-2 font-semibold" asChild>
          <Link href="/redeem">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("Redeem")}
          </Link>
        </Button>

        <div className="flex items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/admin/briet-logo.svg"
            alt={t("BRIET logo")}
            className="h-14 w-auto shrink-0 rounded-lg shadow-sm ring-1 ring-border/50"
          />
          <div className="flex flex-col space-y-1.5">
            <h2 className="text-3xl font-bold tracking-tight">{t("Redeem a BRIET Bundle")}</h2>
            <p className="text-muted-foreground text-base max-w-2xl">
              {t("Enter the code from your BRIET purchase. Every book in the bundle is downloaded and added to your library.")}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border bg-card shadow-sm p-6 space-y-4 max-w-xl">
        <div className="space-y-2">
          <Label htmlFor="redeem-code">{t("Redeem code")}</Label>
          <div className="flex gap-2">
            <Input
              id="redeem-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABCD-1234"
              autoComplete="off"
              spellCheck={false}
              className="font-mono tracking-wider uppercase"
              disabled={redeem.isPending}
            />
            <Button type="submit" disabled={!code.trim() || redeem.isPending} className="font-semibold shrink-0">
              {redeem.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Ticket className="w-4 h-4 mr-2" />
              )}
              {t("Redeem")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("A code can only be redeemed once.")}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/40 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error.message}</span>
          </div>
        )}

        {result && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900/40 dark:bg-green-950/20">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300">
                  {t("{{count}} book(s) redeemed", { count: result.count })}
                </p>
                <p className="text-sm text-green-700/80 dark:text-green-400/80">
                  {t("Downloading now, track progress below.")}
                </p>
              </div>
            </div>
            <Button size="sm" className="shrink-0 font-semibold" asChild>
              <Link href="/library" onClick={forceFreshLibraryOnNextVisit}>
                {t("View in Library")}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </form>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold tracking-tight">{t("Server Imports")}</h3>
        {imports.length > 0 ? (
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[120px]" />
                <col className="w-[140px]" />
                <col />
                <col className="w-[130px]" />
              </colgroup>
              <TableHeader className="bg-muted/50 border-b">
                <TableRow className="hover:bg-transparent cursor-default">
                  <TableHead className="pl-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">{t("Source")}</TableHead>
                  <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">{t("Edition")}</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-muted-foreground text-xs uppercase tracking-wider">{t("Title")}</TableHead>
                  <TableHead className="text-center font-semibold text-muted-foreground text-xs uppercase tracking-wider pr-3">{t("Status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((job) => (
                  <TableRow key={`${job.source}:${job.olid}`} className="transition-colors duration-200">
                    <TableCell className="pl-3">
                      <span className="text-xs font-medium capitalize text-muted-foreground">{job.source}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[10px] tracking-wider uppercase font-bold bg-muted px-2 py-1 rounded text-muted-foreground">
                        OL{job.olid}M
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell whitespace-normal">
                      <span className="text-[11px] text-muted-foreground">{job.title || "—"}</span>
                    </TableCell>
                    <TableCell className="text-center pr-3">
                      <ImportStatusBadge status={job.status} error={job.error} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mb-2">
                <Download className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-semibold">{t("Nothing importing")}</h3>
              <p className="text-sm text-muted-foreground max-w-[340px] leading-relaxed">
                {t("Books queued by a redeemed bundle show up here until they finish downloading.")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
