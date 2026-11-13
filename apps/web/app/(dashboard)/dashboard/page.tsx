"use client"

import { useState } from "react"
import Link from "next/link"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ArrowRight, CircleAlert, CircleCheck, Ticket } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { ErrorState } from "@/components/ErrorState"
import { AreaChartCard } from "@/components/stats/AreaChartCard"
import { KPI_GRID, KpiCard, LiveDot } from "@/components/stats/KpiCard"
import { useGhostSettings } from "@/hooks/use-ghost-settings"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { DASHBOARD, fillDays, rangeFor, STATS } from "@/lib/subscriptions"
import { ApiError, Dashboard, DashboardSchema, LoanStats, LoanStatsSchema, SubscriptionStats, SubscriptionStatsSchema } from "@/types/api"

const UNREAD = "—" // a part the server couldn't read: never show it as zero
const SERVICES = { database: "Database", storage: "File storage", reader: "Reader" } as const

export default function DashboardPage() {
  const { t } = useTranslation()
  const summary = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => handleApiResponse<Dashboard>(await fetchAdmin("dashboard"), DashboardSchema),
  })
  const ghost = useGhostSettings()

  let body
  if (summary.isLoading) {
    body = (
      <div className="space-y-4" aria-busy="true" aria-label={t("Loading")}>
        <div className={KPI_GRID}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  } else if (!summary.data) {
    const unsupported = summary.error instanceof ApiError && summary.error.status === 404
    body = (
      <ErrorState
        message={unsupported ? t("This Lenny server doesn't have a dashboard yet. Update Lenny, then reload this page.") : summary.error?.message || t("Couldn't load the dashboard.")}
      />
    )
  } else {
    const { books, loans, imports, health } = summary.data
    const down = health ? (Object.keys(SERVICES) as (keyof typeof SERVICES)[]).filter((s) => health[s] !== "ok") : []
    body = (
      <div className="space-y-4 md:space-y-6">
        <div className={KPI_GRID}>
          <KpiCard
            label={t("Books")}
            value={books ? books.total.toLocaleString() : UNREAD}
            footer={<More href="/library">{t("Open the library")}</More>}
            hint={books && t("{{open}} open · {{borrowable}} borrowable · {{subscription}} subscription", books)}
          />
          <KpiCard
            label={t("Active loans")}
            value={loans ? loans.active.toLocaleString() : UNREAD}
            badge={
              !!loans?.overdue && (
                <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-800">
                  <CircleAlert aria-hidden />
                  {t("{{count}} overdue", { count: loans.overdue })}
                </Badge>
              )
            }
            footer={<More href={loans?.overdue ? "/loans?status=overdue" : "/loans"}>{t(loans?.overdue ? "See overdue loans" : "See loans")}</More>}
            hint={loans && t("{{count}} started in the last 30 days", { count: loans.started_30d })}
          />
          <KpiCard
            label={t("Imports in progress")}
            value={imports ? imports.pending.toLocaleString() : UNREAD}
            badge={!!imports?.failed && <Badge variant="destructive">{t("{{count}} failed", { count: imports.failed })}</Badge>}
            footer={<More href="/import">{t("Go to Import & Redeem")}</More>}
            hint={imports && !imports.failed ? t("No failed imports") : undefined}
          />
          <KpiCard
            label={t("Health")}
            value={!health ? UNREAD : down.length ? t("{{count}} down", { count: down.length }) : t("All up")}
            badge={
              health &&
              (down.length ? (
                <Badge variant="destructive" className="gap-1">
                  <CircleAlert aria-hidden />
                  {t("Check")}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-green-200 bg-green-50 text-green-800">
                  <CircleCheck aria-hidden />
                  {t("OK")}
                </Badge>
              ))
            }
            footer={health && (down.length ? t("Down: {{list}}", { list: down.map((s) => t(SERVICES[s])).join(", ") }) : t("Database, file storage and reader"))}
            hint={health && t("Lenny {{version}}", { version: health.version })}
          />
        </div>

        <LoansChart />

        {/* Only libraries that connected a Ghost site see anything about Ghost. */}
        {ghost.data?.site_url && <GhostSection />}
      </div>
    )
  }

  return (
    <div className="@container/main mx-auto w-full max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t(DASHBOARD.title)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("Your Lenny library at a glance.")}</p>
      </div>
      {body}
    </div>
  )
}

function More({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="flex items-center gap-1 underline-offset-4 hover:underline">
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  )
}

/** Loans started per day. Hidden until the server can answer (an older Lenny has no loan stats). */
function LoansChart() {
  const { t } = useTranslation()
  const [days, setDays] = useState(90)
  const { from, to } = rangeFor(days)
  const { data } = useQuery({
    queryKey: ["loan-stats", from, to],
    queryFn: async () => handleApiResponse<LoanStats>(await fetchAdmin(`stats/loans?${new URLSearchParams({ from, to })}`), LoanStatsSchema),
    placeholderData: keepPreviousData,
    retry: false,
  })
  if (!data) return null
  const perDay = fillDays(data.by_day, from, to, { started: 0, returned: 0 }).map((d) => ({ date: d.date, value: d.started }))
  return <AreaChartCard title={t("Loans started")} label="Loans" data={perDay} days={days} onDays={setDays} />
}

/** Ghost members over the last 30 days, from the same query (and cache) as the Subscription stats page. */
function GhostSection() {
  const { t } = useTranslation()
  const { from, to } = rangeFor(30)
  const { data } = useQuery({
    queryKey: ["subscription-stats", from, to],
    queryFn: async () =>
      handleApiResponse<SubscriptionStats>(await fetchAdmin(`stats/subscriptions?${new URLSearchParams({ from, to })}`), SubscriptionStatsSchema),
  })
  const totals = data?.totals
  return (
    <section className="space-y-3" aria-labelledby="ghost-members">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ghost-members" className="flex items-center gap-2 font-semibold">
          <Ticket className="size-4 text-muted-foreground" aria-hidden />
          {t("Ghost members")}
        </h2>
        <More href={STATS.route}>{t("See subscription stats")}</More>
      </div>
      <div className={KPI_GRID}>
        <KpiCard
          label={t("Reading now")}
          value={totals ? totals.active_now.toLocaleString() : UNREAD}
          badge={
            !!totals?.active_now && (
              <Badge variant="outline" className="gap-1.5">
                <LiveDot />
                {t("Live")}
              </Badge>
            )
          }
          hint={t("Opened in the last 15 min")}
        />
        <KpiCard label={t("Opens")} value={totals ? totals.opens.toLocaleString() : UNREAD} hint={t("Last 30 days")} />
        <KpiCard label={t("Patrons")} value={totals ? totals.patrons.toLocaleString() : UNREAD} hint={t("Last 30 days")} />
        <KpiCard label={t("Books read")} value={totals ? totals.books_read.toLocaleString() : UNREAD} hint={t("Last 30 days")} />
      </div>
    </section>
  )
}
