"use client"

import { useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { ErrorState } from "@/components/ErrorState"
import { NativeSelect } from "@/components/NativeSelect"
import { Pager } from "@/components/import/Pager"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { relativeTime } from "@/lib/preload/time"
import { rangeFor, STATS } from "@/lib/subscriptions"
import { ApiError, SubscriptionBookStats, SubscriptionBookStatsSchema, SubscriptionStats, SubscriptionStatsSchema } from "@/types/api"

const RANGES = [7, 30, 90] as const
const PAGE_SIZE = 20
type Sort = "opens" | "patrons" | "last_read"

export default function StatsPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState<number>(30)
  const [sort, setSort] = useState<Sort>("opens")
  const [page, setPage] = useState(0)
  const { from, to } = rangeFor(days)

  const stats = useQuery({
    queryKey: ["subscription-stats", from, to],
    queryFn: async () =>
      handleApiResponse<SubscriptionStats>(await fetchAdmin(`stats/subscriptions?${new URLSearchParams({ from, to })}`), SubscriptionStatsSchema),
  })
  const books = useQuery({
    queryKey: ["subscription-stats", "books", from, to, sort, page],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to, sort, page: String(page + 1), page_size: String(PAGE_SIZE) })
      return handleApiResponse<SubscriptionBookStats>(await fetchAdmin(`stats/subscriptions/books?${params}`), SubscriptionBookStatsSchema)
    },
    placeholderData: keepPreviousData,
  })

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t(STATS.title)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("What members read through your Ghost site. No names or emails are kept.")}</p>
      </div>
      <NativeSelect
        aria-label={t("Period")}
        value={days}
        onChange={(e) => {
          setDays(Number(e.target.value))
          setPage(0)
        }}
      >
        {RANGES.map((d) => (
          <option key={d} value={d}>{t("Last {{count}} days", { count: d })}</option>
        ))}
      </NativeSelect>
    </div>
  )

  if (stats.isLoading) {
    return (
      <div className="space-y-8">
        {header}
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }
  if (!stats.data) {
    const unsupported = stats.error instanceof ApiError && stats.error.status === 404
    return (
      <div className="space-y-8">
        {header}
        <ErrorState
          message={unsupported ? t("This Lenny server doesn't have reading stats yet. Update Lenny, then reload this page.") : stats.error?.message || t("Couldn't load the reading stats.")}
        />
      </div>
    )
  }

  const { totals, by_day, devices } = stats.data
  const maxOpens = Math.max(1, ...by_day.map((d) => d.opens))
  const cards = [
    { label: "Books read", value: totals.books_read },
    { label: "Patrons", value: totals.patrons },
    { label: "Opens", value: totals.opens },
    { label: "Opened in the last 15 min", value: totals.active_now },
  ]

  return (
    <div className="space-y-8">
      {header}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <dt className="text-xs text-muted-foreground">{t(c.label)}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{c.value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>

      {totals.opens === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          {t("No reads in this period. Reads show up here once members open subscription books from your Ghost site.")}
        </p>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <h2 className="mb-3 font-semibold">{t("Per day")}</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Day")}</TableHead>
                    <TableHead className="w-1/2">{t("Opens")}</TableHead>
                    <TableHead className="text-right">{t("Patrons")}</TableHead>
                    <TableHead className="text-right">{t("Books")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {by_day.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="tabular-nums">{d.date}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${(d.opens / maxOpens) * 100}%` }} aria-hidden />
                          <span className="tabular-nums">{d.opens}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{d.patrons}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.books_read}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>

            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <h2 className="mb-3 font-semibold">{t("Devices")}</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Device")}</TableHead>
                    <TableHead className="text-right">{t("Patrons")}</TableHead>
                    <TableHead className="text-right">{t("Opens")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((d) => (
                    <TableRow key={d.device_class}>
                      <TableCell className="capitalize">{t(d.device_class)}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.patrons}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.opens}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          </div>

          <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">{t("Books")}</h2>
              <NativeSelect
                aria-label={t("Sort books by")}
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as Sort)
                  setPage(0)
                }}
              >
                <option value="opens">{t("Most opened")}</option>
                <option value="patrons">{t("Most patrons")}</option>
                <option value="last_read">{t("Last read")}</option>
              </NativeSelect>
            </div>
            {books.error && !books.data ? (
              <p className="text-sm text-destructive">{books.error.message || t("Couldn't load the books.")}</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Title")}</TableHead>
                      <TableHead className="text-right">{t("Patrons")}</TableHead>
                      <TableHead className="text-right">{t("Opens")}</TableHead>
                      <TableHead className="text-right">{t("Last read")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {books.data?.items.map((b) => (
                      <TableRow key={String(b.olid)}>
                        <TableCell className="max-w-64 truncate">{b.title || String(b.olid)}</TableCell>
                        <TableCell className="text-right tabular-nums">{b.patrons}</TableCell>
                        <TableCell className="text-right tabular-nums">{b.opens}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{relativeTime(b.last_read)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Pager page={page} total={books.data?.total ?? 0} pageSize={PAGE_SIZE} onPage={setPage} />
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
