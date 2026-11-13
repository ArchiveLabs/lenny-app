"use client"

import { useState } from "react"
import Link from "next/link"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { BookOpen, CircleAlert, Eye, Loader2, Monitor, Radio, Smartphone, Tablet, Ticket, Users } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@workspace/ui/components/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { ErrorState } from "@/components/ErrorState"
import { NativeSelect } from "@/components/NativeSelect"
import { Pager } from "@/components/import/Pager"
import { useGhostSettings } from "@/hooks/use-ghost-settings"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { relativeTime } from "@/lib/preload/time"
import { dayLabel, fillDays, GHOST, rangeFor, STATS } from "@/lib/subscriptions"
import { ApiError, SubscriptionBookStats, SubscriptionBookStatsSchema, SubscriptionStats, SubscriptionStatsSchema } from "@/types/api"

const RANGES = [7, 30, 90] as const
const PAGE_SIZE = 20
type Sort = "opens" | "patrons" | "last_read"
type Day = SubscriptionStats["by_day"][number]

const CHART: ChartConfig = { opens: { label: "Opens", color: "var(--chart-1)" } }
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

  const stats = useQuery({
    queryKey: ["subscription-stats", from, to],
    queryFn: async () =>
      handleApiResponse<SubscriptionStats>(await fetchAdmin(`stats/subscriptions?${new URLSearchParams({ from, to })}`), SubscriptionStatsSchema),
    enabled: connected,
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

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t(STATS.title)}</h1>
          <Badge variant="outline" className="gap-1">
            <Ticket aria-hidden />
            {t("Ghost")}
          </Badge>
        </div>
        <p className="max-w-xl text-sm text-muted-foreground">
          {t("How members of your Ghost site read your subscription books. Only books set to Subscription are counted, and no names or emails are kept.")}
        </p>
      </div>
      {connected && (
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
      )}
    </div>
  )

  const spinner = (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label={t("Loading")} />
    </div>
  )

  let body
  if (ghost.isLoading) body = spinner
  else if (!connected) {
    // No Ghost site (or a server without Ghost): say what this page is for instead of showing empty numbers.
    body = (
      <Alert role="status">
        <Ticket aria-hidden />
        <AlertTitle>{t("Connect a Ghost site to see these stats")}</AlertTitle>
        <AlertDescription>
          <p>{t("Subscription stats count reads of members-only books opened from a Ghost site. This library has no Ghost site connected, so there is nothing to count yet.")}</p>
          <Button asChild size="sm" className="mt-2">
            <Link href={GHOST.route}>{t("Set up Ghost")}</Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  } else if (stats.isLoading) body = spinner
  else if (!stats.data) {
    const unsupported = stats.error instanceof ApiError && stats.error.status === 404
    body = (
      <ErrorState
        message={unsupported ? t("This Lenny server doesn't have subscription stats yet. Update Lenny, then reload this page.") : stats.error?.message || t("Couldn't load the subscription stats.")}
      />
    )
  } else {
    const { totals, by_day, devices } = stats.data
    const tiles = [
      { label: "Books read", value: totals.books_read, icon: BookOpen },
      { label: "Patrons", value: totals.patrons, icon: Users },
      { label: "Opens", value: totals.opens, icon: Eye },
      { label: "Opened in the last 15 min", value: totals.active_now, icon: Radio },
    ]
    const perDay = fillDays(by_day, from, to)
    const maxDeviceOpens = Math.max(1, ...devices.map((d) => d.opens))

    body = (
      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tiles.map(({ label, value, icon: Icon }) => (
            <Card key={label} className="gap-2 py-4">
              <CardHeader className="px-4">
                <dt className="text-sm text-muted-foreground">{t(label)}</dt>
                <CardAction>
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                </CardAction>
              </CardHeader>
              <CardContent className="px-4">
                <dd className="text-3xl font-semibold tabular-nums">{value.toLocaleString()}</dd>
              </CardContent>
            </Card>
          ))}
        </dl>

        {totals.opens === 0 ? (
          <Alert role="status">
            <BookOpen aria-hidden />
            <AlertTitle>{t("No reads in this period")}</AlertTitle>
            <AlertDescription>{t("Reads show up here once members open subscription books from your Ghost site.")}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <Card className="min-w-0">
                <CardHeader>
                  <CardTitle>{t("Opens per day")}</CardTitle>
                  <CardDescription>{`${dayLabel(from)} – ${dayLabel(to)}`}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ChartContainer config={CHART} className="aspect-auto h-56 w-full">
                    <BarChart data={perDay} margin={{ left: -16, right: 4 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={dayLabel} />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                      <ChartTooltip cursor={{ fillOpacity: 0.5 }} content={<DayTooltip />} />
                      <Bar dataKey="opens" fill="var(--color-opens)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ChartContainer>
                  <details className="text-sm">
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("Devices")}</CardTitle>
                  <CardDescription>{t("Where members read")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    {devices.map((d) => {
                      const { label, icon: Icon } = DEVICES[d.device_class] ?? { label: d.device_class, icon: Monitor }
                      return (
                        <li key={d.device_class} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                              {t(label)}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {t("{{opens}} opens · {{patrons}} patrons", { opens: d.opens, patrons: d.patrons })}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted" aria-hidden>
                            <div className="h-2 rounded-full bg-[var(--chart-1)]" style={{ width: `${(d.opens / maxDeviceOpens) * 100}%` }} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t("Books")}</CardTitle>
                <CardDescription>{t("Subscription books members opened in this period")}</CardDescription>
                <CardAction>
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
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                {books.error && !books.data ? (
                  <Alert variant="destructive">
                    <CircleAlert aria-hidden />
                    <AlertTitle>{t("Couldn't load the books")}</AlertTitle>
                    <AlertDescription>{books.error.message}</AlertDescription>
                  </Alert>
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
                            <TableCell className="max-w-64 truncate font-medium">{b.title || String(b.olid)}</TableCell>
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
              </CardContent>
            </Card>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {header}
      {body}
    </div>
  )
}

/** One day on hover: the bar's opens, plus the patrons and books behind them. */
function DayTooltip({ active, payload }: { active?: boolean; payload?: { payload: Day }[] }) {
  const { t } = useTranslation()
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <div className="grid min-w-36 gap-1 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium">{dayLabel(d.date)}</p>
      {[
        ["Opens", d.opens],
        ["Patrons", d.patrons],
        ["Books", d.books_read],
      ].map(([label, value]) => (
        <p key={label} className="flex justify-between gap-4">
          <span className="text-muted-foreground">{t(String(label))}</span>
          <span className="font-mono font-medium tabular-nums">{value}</span>
        </p>
      ))}
    </div>
  )
}
