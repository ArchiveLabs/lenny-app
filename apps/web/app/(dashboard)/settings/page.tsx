"use client"

import Link from "next/link"
import { ChevronRight, BookOpen, Settings2, Shield, Clock, Server } from "lucide-react"
import { Separator } from "@workspace/ui/components/separator"
import { useTranslation } from "react-i18next"

const authSettings = [
  {
    href: "/settings/lending-mode",
    icon: Settings2,
    title: "Lending Mode Config",
    description: "Configure how loans are processed (OpenLibrary, External OAuth, or None)",
  },
  {
    href: "/settings/external-auth",
    icon: Shield,
    title: "External Auth (OIDC)",
    description: "Configure external OIDC provider for patron authentication",
  },
]

const loanSettings = [
  {
    href: "/settings/loan-limits",
    icon: Clock,
    title: "Loan Limits",
    description: "Configure maximum loan durations and concurrency",
  },
]

const providerSettings = [
  {
    href: "/settings/openlibrary",
    icon: BookOpen,
    title: "OpenLibrary Account",
    description: "Connect OpenLibrary account to enable OL-backed lending",
  },
]

export default function SettingsPage() {
  const { t } = useTranslation()
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Settings")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("Manage your Lenny instance configuration.")}</p>
      </div>

      {/* Patron Authentication */}
      <section className="space-y-1">
        <div className="flex items-center gap-2 px-1 mb-3">
          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{t("Patron Authentication")}</span>
        </div>

        <div className="rounded-lg border divide-y overflow-hidden shadow-sm">
          {authSettings.map(({ href, icon: Icon, title, description }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 px-4 py-4 bg-background hover:bg-accent/50 transition-colors group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t(title)}</p>
                <p className="text-sm text-muted-foreground truncate">{t(description)}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>
          ))}
        </div>
      </section>

      {/* Loan Settings */}
      <section className="space-y-1">
        <div className="flex items-center gap-2 px-1 mb-3">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{t("Loan Settings")}</span>
        </div>

        <div className="rounded-lg border divide-y overflow-hidden shadow-sm">
          {loanSettings.map(({ href, icon: Icon, title, description }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 px-4 py-4 bg-background hover:bg-accent/50 transition-colors group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t(title)}</p>
                <p className="text-sm text-muted-foreground truncate">{t(description)}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>
          ))}
        </div>
      </section>

      {/* Providers */}
      <section className="space-y-1">
        <div className="flex items-center gap-2 px-1 mb-3">
          <Server className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{t("Library Providers")}</span>
        </div>

        <div className="rounded-lg border divide-y overflow-hidden shadow-sm">
          {providerSettings.map(({ href, icon: Icon, title, description }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 px-4 py-4 bg-background hover:bg-accent/50 transition-colors group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t(title)}</p>
                <p className="text-sm text-muted-foreground truncate">{t(description)}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
