"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, BookOpen, CircleAlert, CircleCheck, Clock, HeartPulse, Ticket, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { ErrorState } from "@/components/ErrorState"
import { useGhostSettings } from "@/hooks/use-ghost-settings"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { ACCESS_MODES, DASHBOARD, rangeFor, STATS } from "@/lib/subscriptions"
import { AccessMode, ApiError, Dashboard, DashboardSchema, SubscriptionStats, SubscriptionStatsSchema } from "@/types/api"

const MODE_DOT: Record<AccessMode, string> = { open: "bg-green-500", borrowable: "bg-amber-500", subscription: "bg-sky-500" }
const OK = "gap-1 border-green-200 bg-green-50 text-green-800"

export default function DashboardPage() {
  const { t } = useTranslation()
  const summary = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => handleApiResponse<Dashboard>(await fetchAdmin("dashboard"), DashboardSchema),
  })
  const ghost = useGhostSettings()
  const connected = !!ghost.data?.site_url

  if (summary.isLoading) {
    return (
      <Page>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label={t("Loading")}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
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
  return (
    <Page>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Tile title={t("Library")} icon={BookOpen} href="/library" more={t("Open the library")}>
          {books && (
            <>
              <Big value={books.total} label={t(books.total === 1 ? "book" : "books")} />
              <ul className="mt-4 space-y-2 text-sm">
                {(Object.keys(ACCESS_MODES) as AccessMode[]).map((m) => (
                  <li key={m} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${MODE_DOT[m]}`} aria-hidden />
                      {t(ACCESS_MODES[m].label)}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{books[m].toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Tile>

        <Tile title={t("Loans")} icon={Clock} href="/loans" more={t("See active loans")}>
          {loans && (
            <>
              <Big value={loans.active} label={t("active")} />
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center justify-between">
                  <Link href="/loans?status=overdue" className="underline-offset-4 hover:underline">{t("Overdue")}</Link>
                  {loans.overdue > 0 ? (
                    <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-800 tabular-nums">
                      <CircleAlert aria-hidden />
                      {loans.overdue}
                    </Badge>
                  ) : (
                    <span className="tabular-nums text-muted-foreground">0</span>
                  )}
                </li>
                <li className="flex items-center justify-between">
                  <span>{t("Started in the last 30 days")}</span>
                  <span className="tabular-nums text-muted-foreground">{loans.started_30d.toLocaleString()}</span>
                </li>
              </ul>
            </>
          )}
        </Tile>

        <Tile title={t("Imports")} icon={Upload} href="/import" more={t("Go to Import & Redeem")}>
          {imports && (
            <>
              <Big value={imports.pending} label={t("in progress")} />
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center justify-between">
                  <span>{t("Failed")}</span>
                  {imports.failed > 0 ? (
                    <Badge variant="destructive" className="tabular-nums">{imports.failed}</Badge>
                  ) : (
                    <span className="tabular-nums text-muted-foreground">0</span>
                  )}
                </li>
              </ul>
            </>
          )}
        </Tile>

        <Tile title={t("Health")} icon={HeartPulse} description={health ? t("Lenny {{version}}", { version: health.version }) : undefined}>
          {health && (
            <ul className="space-y-2 text-sm">
              {(["database", "storage", "reader"] as const).map((s) => (
                <li key={s} className="flex items-center justify-between">
                  <span>{t({ database: "Database", storage: "File storage", reader: "Reader" }[s])}</span>
                  {health[s] === "ok" ? (
                    <Badge variant="outline" className={OK}>
                      <CircleCheck aria-hidden />
                      {t("Up")}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <CircleAlert aria-hidden />
                      {t("Down")}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Tile>

        {/* Only libraries that connected a Ghost site see anything about Ghost. */}
        {connected && <GhostTile />}
      </div>
    </Page>
  )
}

function Page({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t(DASHBOARD.title)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("Your Lenny library at a glance.")}</p>
      </div>
      {children}
    </div>
  )
}

/** One dashboard card. With no children (the server couldn't read this part) it says so instead of showing zeros. */
function Tile({
  title,
  icon: Icon,
  description,
  href,
  more,
  children,
}: {
  title: string
  icon: typeof BookOpen
  description?: string
  href?: string
  more?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <CardAction>
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1">
        {children || <p className="text-sm text-muted-foreground">{t("Lenny couldn't read this right now.")}</p>}
      </CardContent>
      {href && more && (
        <CardFooter>
          <Link href={href} className="flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
            {more}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </CardFooter>
      )}
    </Card>
  )
}

function Big({ value, label }: { value: number; label: string }) {
  return (
    <p className="flex items-baseline gap-2">
      <span className="text-4xl font-semibold tabular-nums">{value.toLocaleString()}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </p>
  )
}

/** Ghost members over the last 30 days, from the same query (and cache) as the Subscription stats page. */
function GhostTile() {
  const { t } = useTranslation()
  const { from, to } = rangeFor(30)
  const { data } = useQuery({
    queryKey: ["subscription-stats", from, to],
    queryFn: async () =>
      handleApiResponse<SubscriptionStats>(await fetchAdmin(`stats/subscriptions?${new URLSearchParams({ from, to })}`), SubscriptionStatsSchema),
  })
  const totals = data?.totals
  return (
    <Tile title={t("Ghost members")} icon={Ticket} description={t("Last 30 days")} href={STATS.route} more={t("See subscription stats")}>
      {totals && (
        <>
          <p className="flex items-center gap-2">
            {totals.active_now > 0 && (
              <span className="relative flex size-2.5" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2.5 rounded-full bg-green-500" />
              </span>
            )}
            <span className="text-4xl font-semibold tabular-nums">{totals.active_now.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">{t("reading now")}</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span>{t("Opens")}</span>
              <span className="tabular-nums text-muted-foreground">{totals.opens.toLocaleString()}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>{t("Patrons")}</span>
              <span className="tabular-nums text-muted-foreground">{totals.patrons.toLocaleString()}</span>
            </li>
          </ul>
        </>
      )}
    </Tile>
  )
}
