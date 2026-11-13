"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { BookOpen, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

/** The page's panel: white, a soft warm shadow, one radius for every panel on the page. */
export const PANEL = "rounded-2xl border bg-card shadow-[0_1px_2px_rgba(61,56,46,0.05)]"

/** A small bordered square holding an icon, as the panel and number headers use. */
export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background shadow-xs", className)} aria-hidden>
      <Icon className="size-4 text-muted-foreground" />
    </span>
  )
}

/** A panel with an icon-and-title header and an optional action on the right. */
export function Panel({
  icon,
  title,
  description,
  action,
  className,
  children,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn(PANEL, "flex min-w-0 flex-col overflow-hidden", className)} aria-label={title}>
      <header className="flex items-center gap-3 px-5 pt-5">
        <IconTile icon={icon} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-medium">{title}</h2>
          {description && <p className="truncate text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

/** A quiet bordered button-link for a panel header ("View all"). */
export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 rounded-lg border bg-background px-3 py-1.5 text-center text-sm font-medium shadow-xs transition-colors outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {children}
    </Link>
  )
}

/**
 * One headline number: an inner white panel (icon, label, number) set in a tinted frame whose footer
 * carries the context, as in the reference dashboards. With `href` the number opens its page.
 */
export function KpiTile({
  icon,
  label,
  value,
  tone,
  footer,
  aside,
  href,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  tone?: "warn" | "bad"
  footer?: ReactNode
  aside?: ReactNode
  href?: string
}) {
  const inner = (
    <div className="rounded-xl border bg-card p-3 shadow-xs @lg/main:p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <IconTile icon={icon} className="size-7 rounded-md" />
        <p className="truncate text-sm font-medium">{label}</p>
      </div>
      <p className={cn("mt-3 text-2xl leading-none font-semibold tracking-tight tabular-nums @lg/main:mt-4 @lg/main:text-[1.75rem]", tone === "warn" && "text-amber-700", tone === "bad" && "text-destructive")}>
        {value}
      </p>
    </div>
  )
  return (
    <div className="flex flex-col rounded-2xl border bg-secondary/60 p-1.5">
      {href ? (
        <Link href={href} className="rounded-xl outline-none transition-shadow hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50">
          {inner}
        </Link>
      ) : (
        inner
      )}
      <div className="flex min-h-9 items-center justify-between gap-2 px-2 pt-2 pb-1 text-xs @lg/main:px-2.5 @lg/main:text-sm">
        <span className="min-w-0 truncate">{footer}</span>
        {/* On a phone's half-width tile the side note doesn't fit; the footer carries the point. */}
        {aside && <span className="hidden shrink-0 text-muted-foreground @3xl/main:inline">{aside}</span>}
      </div>
    </div>
  )
}

/** "↑ 3" in green or "↓ 2" in red: a change against an earlier period. Zero reads as flat. */
export function Trend({ diff, label }: { diff: number; label: string }) {
  const Icon = diff < 0 ? TrendingDown : TrendingUp
  return (
    <span className={cn("inline-flex items-center gap-1 font-medium tabular-nums", diff > 0 && "text-green-700", diff < 0 && "text-destructive", diff === 0 && "text-muted-foreground")}>
      <Icon className="size-3.5" aria-hidden />
      {diff > 0 ? `+${diff}` : diff}
      <span className="sr-only">{label}</span>
    </span>
  )
}

/** The pill switch: the picked option sits raised on a tinted track. */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border bg-secondary/70 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            value === o.value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Label on the left, value on the right: the key/value rows of a side panel. */
export function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

/** A book's Open Library cover as a list thumbnail, or a book icon when there is none. */
export function CoverThumb({ editionKey, title }: { editionKey?: string | null; title: string }) {
  const [failed, setFailed] = useState(false)
  const olid = editionKey ? (/^\d+$/.test(editionKey) ? `OL${editionKey}M` : editionKey) : null
  if (!olid || failed) {
    return (
      <span className="flex h-11 w-8 shrink-0 items-center justify-center rounded-md border bg-secondary" aria-hidden>
        <BookOpen className="size-3.5 text-muted-foreground" />
      </span>
    )
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`https://covers.openlibrary.org/b/olid/${olid}-S.jpg?default=false`}
      alt={`${title} cover`}
      onError={() => setFailed(true)}
      className="h-11 w-8 shrink-0 rounded-md border object-cover shadow-xs"
    />
  )
}

/** A pulsing green dot: someone is reading right now. Still when the system asks for less motion. */
export function LiveDot() {
  return (
    <span className="relative inline-flex size-2" aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-60 motion-reduce:animate-none" />
      <span className="relative inline-flex size-2 rounded-full bg-green-500" />
    </span>
  )
}

/**
 * Parts of a whole as one segmented bar, with a legend naming each part and its count (so colour is
 * never the only cue). Colours are the theme's chart-1/3/4, checked for colour-blind separation on white.
 */
export function SplitBar({ parts, label }: { parts: { label: string; value: number; color: string }[]; label: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0)
  return (
    <div className="space-y-3">
      <div className="flex h-2 gap-1" role="img" aria-label={label}>
        {total === 0 ? (
          <div className="h-full flex-1 rounded-full bg-muted" />
        ) : (
          parts.filter((p) => p.value > 0).map((p) => (
            <div key={p.label} className="h-full rounded-full" style={{ flexGrow: p.value, background: p.color }} />
          ))
        )}
      </div>
      <ul className="space-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
              {p.label}
            </span>
            <span className="font-medium tabular-nums">{p.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
