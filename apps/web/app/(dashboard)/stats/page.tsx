"use client"

import { useState } from "react"
import Link from "next/link"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { BookCopy, BookOpen, CircleAlert, Eye, LineChart, Monitor, Radio, Smartphone, Tablet, Ticket, Users } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { ErrorState } from "@/components/ErrorState"
import { NativeSelect } from "@/components/NativeSelect"
import { Pager } from "@/components/import/Pager"
import { AreaChartCard } from "@/components/stats/AreaChartCard"
import { KpiTile, LiveDot, Panel } from "@/components/stats/ui"
import { useGhostSettings } from "@/hooks/use-ghost-settings"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { relativeTime } from "@/lib/preload/time"
import { dayLabel, fillDays, GHOST, rangeFor, STATS, SUBSCRIPTIONS_DOC } from "@/lib/subscriptions"
import { ApiError, SubscriptionBookStats, SubscriptionBookStatsSchema, SubscriptionStats, SubscriptionStatsSchema } from "@/types/api"

const PAGE_SIZE = 20
type Sort = "opens" | "patrons" | "last_read"

const DEVICES: Record<string, { label: string; icon: typeof Monitor }> = {
  desktop: { label: "Desktop", icon: Monitor },
  mobile: { label: "Phone", icon: Smartphone },
  tablet: { label: "Tablet", icon: Tablet },
}

export default function StatsPage() {
  const { t } = useTranslation()
  const ghost = useGhostSettings()
  const connected = !!ghost.data?.site_url
  const [days, setDays] = useState<number>(30)
  const [sort, setSort] = useState<Sort>("opens")
  const [page, setPage] = useState(0)
  const { from, to } = rangeFor(days)
  const period = t("Last {{count}} days", { count: days })

  const stats = useQuery({
    queryKey: ["subscription-stats", from, to],
    queryFn: async () =>
      handleApiResponse<SubscriptionStats>(await fetchAdmin(`stats/subscriptions?${new URLSearchParams({ from, to })}`), SubscriptionStatsSchema),
    enabled: connected,
    placeholderData: keepPreviousData,
  })
  const books = useQuery({
    queryKey: ["subscription-stats", "books", from, to, sort, page],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to, sort, page: String(page + 1), page_size: String(PAGE_SIZE) })
      return handleApiResponse<SubscriptionBookStats>(await fetchAdmin(`stats/subscriptions/books?${params}`), SubscriptionBookStatsSchema)
    },
    enabled: connected && !!stats.data?.totals.opens,
    placeholderData: keepPreviousData,
  })

  const changeDays = (d: number) => {
    setDays(d)
    setPage(0)
  }

  let body
  if (ghost.isLoading || (connected && stats.isLoading)) {
    body = (
      <div className="space-y-4" aria-busy="true" aria-label={t("Loading")}>
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  } else if (!connected) {
    // No Ghost site (or a server without Ghost): say what this page is for instead of showing empty numbers.
    body = (
      <div role="status" className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Ticket className="size-5 text-muted-foreground" aria-hidden />
        </div>
        <div className="max-w-md space-y-1.5">
          <h2 className="font-semibold">{t("Connect a Ghost site to see these stats")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("Subscription stats count reads of members-only books opened from a Ghost site. This library has no Ghost site connected, so there is nothing to count yet.")}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={GHOST.route}>{t("Set up Ghost")}</Link>
        </Button>
      </div>
    )
  } else if (!stats.data) {
    const unsupported = stats.error instanceof ApiError && stats.error.status === 404
    body = (
      <ErrorState
        message={unsupported ? t("This Lenny server doesn't have subscription stats yet. Update Lenny, then reload this page.") : stats.error?.message || t("Couldn't load the subscription stats.")}
      />
    )
  } else {
    const { totals, by_day, devices } = stats.data
    const perDay = fillDays(by_day, from, to, { books_read: 0, patrons: 0, opens: 0 })
    const deviceOpens = devices.reduce((n, d) => n + d.opens, 0) || 1

    body = (
      <div className="space-y-4">
        <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          <KpiTile icon={Eye} label={t("Opens")} value={totals.opens.toLocaleString()} footer={<span className="text-muted-foreground">{t("Books opened by members")}</span>} aside={period} />
          <KpiTile icon={Users} label={t("Patrons")} value={totals.patrons.toLocaleString()} footer={<span className="text-muted-foreground">{t("Different members")}</span>} aside={period} />
          <KpiTile icon={BookCopy} label={t("Books read")} value={totals.books_read.toLocaleString()} footer={<span className="text-muted-foreground">{t("Subscription books")}</span>} aside={period} />
          <KpiTile
            icon={Radio}
            label={t("Reading now")}
            value={totals.active_now.toLocaleString()}
            footer={
              totals.active_now > 0 ? (
                <span className="inline-flex items-center gap-2 font-medium text-green-700">
                  <LiveDot />
                  {t("Live")}
                </span>
              ) : (
                <span className="text-muted-foreground">{t("Nobody right now")}</span>
              )
            }
            aside={t("last 15 min")}
          />
        </div>

        <AreaChartCard
          icon={LineChart}
          title={t("Reading")}
          series={[
            { key: "opens", label: "Opens", color: "var(--chart-1)" },
            { key: "patrons", label: "Patrons", color: "var(--chart-3)", dashed: true },
          ]}
          data={perDay}
          days={days}
          onDays={changeDays}
        >
          {totals.opens > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t("Show as a table")}</summary>
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Day")}</TableHead>
                    <TableHead className="text-right">{t("Opens")}</TableHead>
                    <TableHead className="text-right">{t("Patrons")}</TableHead>
                    <TableHead className="text-right">{t("Books")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {by_day.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell>{dayLabel(d.date)}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.opens}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.patrons}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.books_read}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </details>
          )}
        </AreaChartCard>

        {totals.opens === 0 ? (
          <Alert role="status">
            <BookOpen aria-hidden />
            <AlertTitle>{t("No reads in this period")}</AlertTitle>
            <AlertDescription>
              <p>{t("Reads show up here once members open subscription books from your Ghost site.")}</p>
              <a href={SUBSCRIPTIONS_DOC} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-4">
                {t("Learn how to add Read buttons to your Ghost posts")}
              </a>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-4 @5xl/main:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Panel icon={Monitor} title={t("Devices")} description={t("Share of opens")}>
              <div className="p-5">
                <ul className="space-y-4">
                  {devices.map((d) => {
                    const { label, icon: Icon } = DEVICES[d.device_class] ?? { label: d.device_class, icon: Monitor }
                    const share = d.opens / deviceOpens
                    return (
                      <li key={d.device_class} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                            {t(label)}
                          </span>
                          <span className="font-medium tabular-nums">{Math.round(share * 100)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted" aria-hidden>
                          <div className="h-2 rounded-full bg-[var(--chart-1)]" style={{ width: `${share * 100}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {t("{{opens}} opens · {{patrons}} patrons", { opens: d.opens, patrons: d.patrons })}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </Panel>

            <Panel
              icon={BookOpen}
              title={t("Books")}
              description={t("Subscription books members opened")}
              action={
                  <NativeSelect
                    aria-label={t("Sort books by")}
                    className="h-8 text-sm"
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
              }
            >
              <div className="space-y-4 p-5 pt-4">
                {books.error && !books.data ? (
                  <Alert variant="destructive">
                    <CircleAlert aria-hidden />
                    <AlertTitle>{t("Couldn't load the books")}</AlertTitle>
                    <AlertDescription>{books.error.message}</AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="-mx-5 border-t">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10 pl-5">#</TableHead>
                            <TableHead>{t("Title")}</TableHead>
                            <TableHead className="text-right">{t("Patrons")}</TableHead>
                            <TableHead className="text-right">{t("Opens")}</TableHead>
                            <TableHead className="pr-5 text-right sm:pr-6">{t("Last read")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {books.data?.items.map((b, i) => (
                            <TableRow key={String(b.olid)}>
                              <TableCell className="pl-5 text-muted-foreground tabular-nums sm:pl-6">{page * PAGE_SIZE + i + 1}</TableCell>
                              <TableCell className="max-w-64 truncate font-medium">{b.title || String(b.olid)}</TableCell>
                              <TableCell className="text-right tabular-nums">{b.patrons}</TableCell>
                              <TableCell className="text-right tabular-nums">{b.opens}</TableCell>
                              <TableCell className="pr-5 text-right text-muted-foreground sm:pr-6">{relativeTime(b.last_read) || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <Pager page={page} total={books.data?.total ?? 0} pageSize={PAGE_SIZE} onPage={setPage} />
                  </>
                )}
              </div>
            </Panel>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="@container/main mx-auto w-full max-w-7xl space-y-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t(STATS.title)}</h1>
          <Badge variant="secondary" className="gap-1 font-normal">
            <Ticket aria-hidden />
            {t("Ghost")}
          </Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {connected
            ? t("How members of {{site}} read your subscription books. Only books set to Subscription are counted, and no names or emails are kept.", { site: siteHost(ghost.data!.site_url!) })
            : t("How members of your Ghost site read your subscription books. Only books set to Subscription are counted, and no names or emails are kept.")}
        </p>
      </div>
      {body}
    </div>
  )
}

/** "flaminghydra.com" from the saved site URL, for the header. */
const siteHost = (url: string) => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
