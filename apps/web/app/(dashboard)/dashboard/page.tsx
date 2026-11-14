"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { BookOpen, CircleAlert, Clock, Hourglass, Library, LineChart, Ticket, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { ErrorState } from "@/components/ErrorState"
import { AreaChartCard } from "@/components/stats/AreaChartCard"
import { CoverThumb, KpiTile, Panel, PanelLink, Row, SplitBar, Trend } from "@/components/stats/ui"
import { useGhostSettings } from "@/hooks/use-ghost-settings"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { relativeTime } from "@/lib/preload/time"
import { ACCESS_MODES, byWeek, DASHBOARD, dayLabel, fillDays, rangeFor, STATS } from "@/lib/subscriptions"
import {
  AccessMode,
  AdminLoan,
  ApiError,
  Dashboard,
  DashboardSchema,
  LoanStats,
  LoanStatsSchema,
  PaginatedAdminLoans,
  PaginatedAdminLoansSchema,
  SubscriptionStats,
  SubscriptionStatsSchema,
} from "@/types/api"

const UNREAD = "—" // a part the server couldn't read: never show it as zero
const SERVICES = { database: "Database", storage: "File storage", reader: "Reader" } as const
type Service = keyof typeof SERVICES
// Theme chart-1/3/4: checked for colour-blind separation and contrast on white (the admin is light-only).
const MODE_COLOR: Record<AccessMode, string> = { open: "var(--chart-1)", borrowable: "var(--chart-3)", subscription: "var(--chart-4)" }
const LOAN_SERIES = [
  { key: "started", label: "Started", color: "var(--chart-1)" },
  { key: "returned", label: "Returned", color: "var(--chart-3)", dashed: true },
]
const LINK = "font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"

export default function DashboardPage() {
  const { t } = useTranslation()
  const summary = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => handleApiResponse<Dashboard>(await fetchAdmin("dashboard"), DashboardSchema),
  })
  const ghost = useGhostSettings()
  const week = useLoanWeeks()

  if (summary.isLoading) {
    return (
      <Page>
        <div className="space-y-4" aria-busy="true" aria-label={t("Loading")}>
          <div className="grid grid-cols-2 gap-3 @5xl/main:grid-cols-4 @5xl/main:gap-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
          <Skeleton className="h-[420px] rounded-2xl" />
        </div>
      </Page>
    )
  }
  if (!summary.data) {
    const unsupported = summary.error instanceof ApiError && summary.error.status === 404
    return (
      <Page>
        <ErrorState
          message={unsupported ? t("This Lenny server doesn't have a dashboard yet. Update Lenny, then reload this page.") : summary.error?.message || t("Couldn't load the dashboard.")}
        />
      </Page>
    )
  }

  const { books, loans, imports, health } = summary.data
  const down = health ? (Object.keys(SERVICES) as Service[]).filter((s) => health[s] !== "ok") : []
  const connected = !!ghost.data?.site_url

  return (
    <Page status={health && <StatusPill down={down.length} />}>
      {down.length > 0 && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{t("{{list}} not responding", { list: down.map((s) => t(SERVICES[s])).join(t(" and ")) })}</AlertTitle>
          <AlertDescription>{t("Patrons may not be able to open books until it is back. Check the Lenny containers on your server.")}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 @5xl/main:grid-cols-4 @5xl/main:gap-4">
        <KpiTile
          icon={BookOpen}
          label={t("Books")}
          value={books ? books.total.toLocaleString() : UNREAD}
          href="/library"
          footer={books && <span className="text-muted-foreground">{t("{{count}} borrowable", { count: books.borrowable })}</span>}
          aside={books && t("{{count}} open", { count: books.open })}
        />
        <KpiTile
          icon={Clock}
          label={t("On loan now")}
          value={loans ? loans.active.toLocaleString() : UNREAD}
          href="/loans"
          footer={week && <Trend diff={week.now - week.before} label={t("loans started, against the week before")} />}
          aside={week && t("vs last week")}
        />
        <KpiTile
          icon={Hourglass}
          label={t("Overdue")}
          value={loans ? loans.overdue.toLocaleString() : UNREAD}
          tone={loans?.overdue ? "warn" : undefined}
          href="/loans?status=overdue"
          footer={loans && (loans.overdue ? <span className="font-medium text-amber-700">{t("Needs a look")}</span> : <span className="font-medium text-green-700">{t("All on time")}</span>)}
          aside={t("past due date")}
        />
        <KpiTile
          icon={Upload}
          label={t("Imports")}
          value={imports ? imports.pending.toLocaleString() : UNREAD}
          tone={imports?.failed ? "bad" : undefined}
          href="/import"
          footer={
            imports &&
            (imports.failed ? (
              <span className="font-medium text-destructive">{t(imports.failed === 1 ? "1 failed" : "{{count}} failed", { count: imports.failed })}</span>
            ) : (
              <span className="text-muted-foreground">{t("Nothing failed")}</span>
            ))
          }
          aside={t("in progress")}
        />
      </div>

      <div className="grid gap-4 @5xl/main:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <LoansChart stillOut={loans?.active} />
        <LibraryPanel books={books} health={health} down={down} />
      </div>

      <div className={cn("grid gap-4", connected && "@5xl/main:grid-cols-2")}>
        <RecentLoans />
        {connected && <GhostPanel />}
      </div>
    </Page>
  )
}

function Page({ status, children }: { status?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="@container/main mx-auto w-full max-w-7xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t(DASHBOARD.title)}</h1>
        {status}
      </header>
      {children}
    </div>
  )
}

function StatusPill({ down }: { down: number }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm shadow-xs">
      <span className={cn("size-2 rounded-full", down ? "bg-destructive" : "bg-green-500")} aria-hidden />
      {down ? t("Some services are down") : t("All services running")}
    </span>
  )
}

/** Loans started in the last 7 days and the 7 before. Null until known (an older Lenny has no loan stats). */
function useLoanWeeks() {
  const { from, to } = rangeFor(14)
  const { data } = useQuery({
    queryKey: ["loan-stats", from, to],
    queryFn: async () => handleApiResponse<LoanStats>(await fetchAdmin(`stats/loans?${new URLSearchParams({ from, to })}`), LoanStatsSchema),
    retry: false,
  })
  if (!data) return null
  const days = fillDays(data.by_day, from, to, { started: 0, returned: 0 })
  const sum = (xs: typeof days) => xs.reduce((n, d) => n + d.started, 0)
  return { before: sum(days.slice(0, 7)), now: sum(days.slice(7)) }
}

/** Loans started and returned over time. Hidden until the server can answer. */
function LoansChart({ stillOut }: { stillOut?: number }) {
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
  const perDay = fillDays(data.by_day, from, to, { started: 0, returned: 0 })
  const weekly = days > 31
  const buckets = weekly ? byWeek(perDay) : perDay
  const busiest = buckets.reduce((a, b) => (b.started > a.started ? b : a), buckets[0]!)
  const started = perDay.reduce((n, d) => n + d.started, 0)
  return (
    <AreaChartCard
      icon={LineChart}
      title={t("Loans")}
      series={LOAN_SERIES}
      data={perDay}
      days={days}
      onDays={setDays}
      summary={[
        { label: t(weekly ? "Busiest week" : "Busiest day"), value: busiest.started ? `${dayLabel(busiest.date)}, ${busiest.started}` : UNREAD },
        { label: t(weekly ? "Average per week" : "Average per day"), value: (started / buckets.length).toFixed(1) },
        { label: t("Returned"), value: perDay.reduce((n, d) => n + d.returned, 0).toLocaleString() },
        { label: t("Still out"), value: stillOut ?? UNREAD },
      ]}
    />
  )
}

/** What the library holds, by access mode, and whether its services answer. */
function LibraryPanel({ books, health, down }: { books: Dashboard["books"]; health: Dashboard["health"]; down: Service[] }) {
  const { t } = useTranslation()
  return (
    <Panel icon={Library} title={t("Library")} description={t("Books by access mode")}>
      <div className="flex flex-1 flex-col gap-5 p-5">
        {books ? (
          <SplitBar
            label={t("{{open}} open, {{borrowable}} borrowable, {{subscription}} subscription", books)}
            parts={(Object.keys(MODE_COLOR) as AccessMode[]).map((m) => ({ label: t(ACCESS_MODES[m].label), value: books[m], color: MODE_COLOR[m] }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("Lenny couldn't count the books right now.")}</p>
        )}
        <div className="divide-y rounded-xl border bg-secondary/40 px-4">
          {health ? (
            <>
              {(Object.keys(SERVICES) as Service[]).map((s) => (
                <Row key={s} label={t(SERVICES[s])}>
                  <span className={cn("inline-flex items-center gap-1.5", down.includes(s) ? "text-destructive" : "text-green-700")}>
                    <span className={cn("size-1.5 rounded-full", down.includes(s) ? "bg-destructive" : "bg-green-500")} aria-hidden />
                    {t(down.includes(s) ? "Down" : "Running")}
                  </span>
                </Row>
              ))}
              <Row label={t("Version")}>{health.version}</Row>
            </>
          ) : (
            <Row label={t("Services")}>{t("Couldn't check")}</Row>
          )}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2">
          <PanelLink href="/library">{t("Open library")}</PanelLink>
          <PanelLink href="/import">{t("Add books")}</PanelLink>
        </div>
      </div>
    </Panel>
  )
}

const STATUS_NOTE: Record<AdminLoan["status"], { label: string; className: string }> = {
  active: { label: "On loan", className: "text-foreground" },
  overdue: { label: "Overdue", className: "text-amber-700" },
  returned: { label: "Returned", className: "text-muted-foreground" },
}

/** The five latest loans, newest first, each with its book cover. */
function RecentLoans() {
  const { t } = useTranslation()
  const { data } = useQuery({
    queryKey: ["admin-loans", "recent"],
    queryFn: async () =>
      handleApiResponse<PaginatedAdminLoans>(
        await fetchAdmin(`loans?${new URLSearchParams({ paginated: "true", limit: "5", offset: "0", sort: "borrowed_at", order: "desc" })}`),
        PaginatedAdminLoansSchema,
      ),
  })
  if (!data) return null
  return (
    <Panel icon={Clock} title={t("Recent loans")} action={<PanelLink href="/loans">{t("View all")}</PanelLink>}>
      {data.items.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">{t("No loans yet. They appear here when a patron borrows a book.")}</p>
      ) : (
        <ul className="mx-5 mt-3 mb-2 divide-y">
          {data.items.map((loan) => {
            const title = loan.book_title || loan.edition_key || "—"
            return (
              <li key={loan.id} className="flex items-center gap-3 py-3">
                <CoverThumb editionKey={loan.edition_key} title={title} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{title}</p>
                  <p className="truncate text-xs text-muted-foreground">{t("Patron {{id}}", { id: loan.user_identifier ? loan.user_identifier.slice(0, 12) : "—" })}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn("text-sm font-medium", STATUS_NOTE[loan.status].className)}>{t(STATUS_NOTE[loan.status].label)}</p>
                  <p className="text-xs text-muted-foreground">{relativeTime(loan.borrowed_at) || "—"}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/** Ghost members over the last 30 days, from the same query (and cache) as the Subscription stats page. */
function GhostPanel() {
  const { t } = useTranslation()
  const { from, to } = rangeFor(30)
  const { data } = useQuery({
    queryKey: ["subscription-stats", from, to],
    queryFn: async () =>
      handleApiResponse<SubscriptionStats>(await fetchAdmin(`stats/subscriptions?${new URLSearchParams({ from, to })}`), SubscriptionStatsSchema),
  })
  const totals = data?.totals
  return (
    <Panel icon={Ticket} title={t("Ghost members")} description={t("Last 30 days")} action={<PanelLink href={STATS.route}>{t("Subscription stats")}</PanelLink>}>
      <div className="m-5 mt-4 divide-y rounded-xl border bg-secondary/40 px-4">
        <Row label={t("Readers in the last 15 min")}>{totals ? totals.active_now.toLocaleString() : UNREAD}</Row>
        <Row label={t("Opens")}>{totals ? totals.opens.toLocaleString() : UNREAD}</Row>
        <Row label={t("Patrons")}>{totals ? totals.patrons.toLocaleString() : UNREAD}</Row>
        <Row label={t("Books read")}>{totals ? totals.books_read.toLocaleString() : UNREAD}</Row>
      </div>
      <p className="px-5 pb-5 text-xs text-muted-foreground">
        {t("Members read on passes, not loans.")}{" "}
        <Link href="/loans" className={LINK}>{t("See passes")}</Link>
      </p>
    </Panel>
  )
}
