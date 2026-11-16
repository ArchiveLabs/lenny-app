"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { BookOpen, ChevronRight, Clock, PlugZap, Settings2, Shield, Ticket, type LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@workspace/ui/lib/utils"
import { IconTile, PANEL } from "@/components/stats/ui"
import { useGhostSettings } from "@/hooks/use-ghost-settings"
import { useOAuth2Clients } from "@/hooks/use-oauth2-clients"
import { APP_ACCESS, SIGN_IN_PROVIDER } from "@/lib/app-access"
import { GHOST } from "@/lib/subscriptions"

type Item = { href: string; icon: LucideIcon; title: string; description: string; status?: ReactNode }

/** A status word with a dot, as the dashboard shows services. */
function Status({ tone, children }: { tone: "good" | "warn" | "muted"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-xs font-medium",
        tone === "good" ? "text-green-700" : tone === "warn" ? "text-amber-700" : "text-muted-foreground",
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", tone === "good" ? "bg-green-500" : tone === "warn" ? "bg-amber-500" : "bg-muted-foreground/50")}
        aria-hidden
      />
      {children}
    </span>
  )
}

function Section({ title, help, items }: { title: string; help: string; items: Item[] }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <div className="px-1">
        <h2 className="font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{help}</p>
      </div>
      <ul className={cn(PANEL, "divide-y overflow-hidden")}>
        {items.map(({ href, icon, title, description, status }) => (
          <li key={href}>
            <Link href={href} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/40">
              <IconTile icon={icon} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <p className="text-sm font-medium">{title}</p>
                  {status}
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const { data: apps } = useOAuth2Clients()
  const { data: ghost } = useGhostSettings()

  const active = apps?.clients.filter((c) => c.status === "active").length ?? 0
  const disabled = (apps?.clients.length ?? 0) - active
  const ghostStatus = ghost && (
    !ghost.site_url ? <Status tone="muted">{t("Not connected")}</Status>
      : ghost.enabled ? <Status tone="good">{t("Connected")}</Status>
        : <Status tone="warn">{t("Turned off")}</Status>
  )

  const lending: Item[] = [
    {
      href: "/settings/lending-mode",
      icon: Settings2,
      title: t("Lending Mode Config"),
      description: t("Configure how loans are processed (OpenLibrary, External OAuth, or None)"),
    },
    {
      href: "/settings/loan-limits",
      icon: Clock,
      title: t("Loan Limits"),
      description: t("Configure maximum loan durations and concurrency"),
    },
  ]

  const connectors: Item[] = [
    { href: GHOST.route, icon: Ticket, title: t(GHOST.title), description: t(GHOST.description), status: ghostStatus },
    {
      href: "/settings/openlibrary",
      icon: BookOpen,
      title: t("OpenLibrary Account"),
      description: t("Connect OpenLibrary account to enable OL-backed lending"),
    },
    { href: SIGN_IN_PROVIDER.route, icon: Shield, title: t(SIGN_IN_PROVIDER.title), description: t(SIGN_IN_PROVIDER.description) },
    {
      href: APP_ACCESS.route,
      icon: PlugZap,
      title: t(APP_ACCESS.title),
      description: t(APP_ACCESS.description),
      status: apps && (
        <Status tone={active ? "good" : "muted"}>
          {t(active === 1 ? "1 active app" : "{{count}} active apps", { count: active })}
          {disabled > 0 && `, ${t("{{count}} disabled", { count: disabled })}`}
        </Status>
      ),
    },
  ]

  return (
    <div className="w-full max-w-2xl min-w-0 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Settings")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("Manage your Lenny instance configuration.")}</p>
      </header>
      <Section title={t("Lending")} help={t("How patrons borrow books, and for how long.")} items={lending} />
      <Section
        title={t("Plugins & connectors")}
        help={t("Outside services this library connects to, and the apps that read from it.")}
        items={connectors}
      />
    </div>
  )
}
