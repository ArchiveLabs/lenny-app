"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { CircleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { ErrorState } from "@/components/ErrorState"
import { AreaChartCard } from "@/components/stats/AreaChartCard"
import { LiveDot, SplitBar, Stat, StatStrip } from "@/components/stats/StatStrip"
import { useGhostSettings } from "@/hooks/use-ghost-settings"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { relativeTime } from "@/lib/preload/time"
import { ACCESS_MODES, DASHBOARD, fillDays, rangeFor, STATS } from "@/lib/subscriptions"
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
        <div className="space-y-6" aria-busy="true" aria-label={t("Loading")}>
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
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

  return (
    <Page status={<StatusLine health={health} down={down} imports={imports} />}>
      {down.length > 0 && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{t("{{list}} not responding", { list: down.map((s) => t(SERVICES[s])).join(t(" and ")) })}</AlertTitle>
          <AlertDescription>{t("Patrons may not be able to open books until it is back. Check the Lenny containers on your server.")}</AlertDescription>
        </Alert>
      )}
      {!!imports?.failed && (
        <Alert>
          <CircleAlert aria-hidden />
          <AlertTitle>{t(imports.failed === 1 ? "1 import failed" : "{{count}} imports failed", { count: imports.failed })}</AlertTitle>
          <AlertDescription>
            <Link href="/import" className={LINK}>{t("Review failed imports")}</Link>
          </AlertDescription>
        </Alert>
      )}

      <StatStrip label={t("Library")}>
        <Stat label={t("Books")} value={books ? books.total.toLocaleString() : UNREAD} href="/library">
          {books && (
            <SplitBar
              label={t("{{open}} open, {{borrowable}} borrowable, {{subscription}} subscription", books)}
              parts={(Object.keys(MODE_COLOR) as AccessMode[]).map((m) => ({ label: t(ACCESS_MODES[m].label), value: books[m], color: MODE_COLOR[m] }))}
            />
          )}
        </Stat>
        <Stat
          label={t("On loan now")}
          value={loans ? loans.active.toLocaleString() : UNREAD}
          href="/loans"
          note={loans && t(loans.started_30d === 1 ? "1 loan started in the last 30 days" : "{{count}} loans started in the last 30 days", { count: loans.started_30d })}
        />
        <Stat
          label={t("Overdue")}
          value={loans ? loans.overdue.toLocaleString() : UNREAD}
          tone={loans?.overdue ? "warn" : undefined}
          href="/loans?status=overdue"
          note={loans && (loans.overdue ? t("Past their due date and not returned") : t("Every loan is within its time"))}
        />
        <Stat label={t("Started this week")} value={week ? week.now.toLocaleString() : UNREAD} note={week && weekNote(t, week.now - week.before)} />
      </StatStrip>

      <LoansChart />
      <RecentLoans />

      {/* Only libraries that connected a Ghost site see anything about Ghost. */}
      {ghost.data?.site_url && <GhostStrip />}
    </Page>
  )
}

function Page({ status, children }: { status?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="@container/main mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{t(DASHBOARD.title)}</h1>
        {status}
      </header>
      {children}
    </div>
  )
}

/** One quiet line under the title: whether Lenny is healthy and busy. Problems also get an alert. */
function StatusLine({ health, down, imports }: { health: Dashboard["health"]; down: Service[]; imports: Dashboard["imports"] }) {
  const { t } = useTranslation()
  if (!health) return <p className="text-sm text-muted-foreground">{t("Lenny couldn't check its services right now.")}</p>
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
      <span className={cn("size-2 rounded-full", down.length ? "bg-destructive" : "bg-green-500")} aria-hidden />
      <span>{`${down.length ? t("Some services are down") : t("All services running")}, ${t("Lenny {{version}}", { version: health.version })}.`}</span>
      {imports && imports.pending > 0 && (
        <Link href="/import" className={LINK}>
          {t(imports.pending === 1 ? "1 import in progress" : "{{count}} imports in progress", { count: imports.pending })}
        </Link>
      )}
    </p>
  )
}

function weekNote(t: (s: string, o?: Record<string, unknown>) => string, diff: number) {
  if (diff === 0) return t("Same as the week before")
  return diff > 0
    ? t(diff === 1 ? "1 more than the week before" : "{{count}} more than the week before", { count: diff })
    : t(-diff === 1 ? "1 fewer than the week before" : "{{count}} fewer than the week before", { count: -diff })
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

/** Loans started per day. Hidden until the server can answer. */
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

const STATUS_NOTE: Record<AdminLoan["status"], { label: string; className: string }> = {
  active: { label: "On loan", className: "text-muted-foreground" },
  overdue: { label: "Overdue", className: "text-amber-700" },
  returned: { label: "Returned", className: "text-muted-foreground" },
}

/** The five latest loans, newest first. */
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
    <section className="rounded-xl border bg-card" aria-labelledby="recent-loans">
      <div className="flex items-baseline justify-between gap-4 px-5 pt-5 sm:px-6">
        <h2 id="recent-loans" className="font-medium">{t("Recent loans")}</h2>
        <Link href="/loans" className={cn(LINK, "text-sm")}>{t("All loans")}</Link>
      </div>
      {data.items.length === 0 ? (
        <p className="px-5 pt-2 pb-6 text-sm text-muted-foreground sm:px-6">{t("No loans yet. They appear here when a patron borrows a book.")}</p>
      ) : (
        <ul className="mt-3 divide-y border-t">
          {data.items.map((loan) => (
            <li key={loan.id} className="flex items-center gap-4 px-5 py-3 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{loan.book_title || loan.edition_key || "—"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t("Patron {{id}}", { id: loan.user_identifier ? loan.user_identifier.slice(0, 12) : "—" })}
                  {loan.borrowed_at && `, ${relativeTime(loan.borrowed_at)}`}
                </p>
              </div>
              <span className={cn("shrink-0 text-sm", STATUS_NOTE[loan.status].className)}>{t(STATUS_NOTE[loan.status].label)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Ghost members over the last 30 days, from the same query (and cache) as the Subscription stats page. */
function GhostStrip() {
  const { t } = useTranslation()
  const { from, to } = rangeFor(30)
  const { data } = useQuery({
    queryKey: ["subscription-stats", from, to],
    queryFn: async () =>
      handleApiResponse<SubscriptionStats>(await fetchAdmin(`stats/subscriptions?${new URLSearchParams({ from, to })}`), SubscriptionStatsSchema),
  })
  const totals = data?.totals
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-medium">{t("Ghost members")}</h2>
        <Link href={STATS.route} className={cn(LINK, "text-sm")}>{t("Subscription stats")}</Link>
      </div>
      <StatStrip label={t("Ghost members")}>
        <Stat
          label={t("Reading now")}
          value={
            <span className="inline-flex items-center gap-3">
              {totals ? totals.active_now.toLocaleString() : UNREAD}
              {!!totals?.active_now && <LiveDot />}
            </span>
          }
          note={t("Opened a book in the last 15 minutes")}
        />
        <Stat label={t("Opens")} value={totals ? totals.opens.toLocaleString() : UNREAD} note={t("In the last 30 days")} />
        <Stat label={t("Patrons")} value={totals ? totals.patrons.toLocaleString() : UNREAD} note={t("Different members, last 30 days")} />
        <Stat label={t("Books read")} value={totals ? totals.books_read.toLocaleString() : UNREAD} note={t("Subscription books opened")} />
      </StatStrip>
    </div>
  )
}
