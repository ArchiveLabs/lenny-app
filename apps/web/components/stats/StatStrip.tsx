import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "@workspace/ui/lib/utils"

/**
 * A row of headline numbers in one panel, split by hairlines (the 1px gap shows the border colour).
 * One column on phones, two on tablets, `cols` on wide screens.
 */
export function StatStrip({ label, cols = 4, children }: { label: string; cols?: 3 | 4; children: ReactNode }) {
  return (
    <section
      aria-label={label}
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border bg-border @xl/main:grid-cols-2",
        cols === 4 ? "@5xl/main:grid-cols-4" : "@5xl/main:grid-cols-3",
      )}
    >
      {children}
    </section>
  )
}

/**
 * One number in a StatStrip. `tone` colours the number only when it is a problem; `note` says what it
 * means in plain words. With `href` the whole cell opens the page behind the number.
 */
export function Stat({
  label,
  value,
  note,
  tone,
  href,
  children,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  tone?: "warn" | "bad"
  href?: string
  children?: ReactNode
}) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-[2rem] leading-none font-medium tracking-tight tabular-nums",
          tone === "warn" && "text-amber-700",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
      {children && <div className="mt-4">{children}</div>}
      {note && <p className="mt-3 text-sm text-muted-foreground">{note}</p>}
    </>
  )
  const cell = "flex flex-col bg-card p-5"
  if (!href) return <div className={cell}>{body}</div>
  return (
    <Link href={href} className={cn(cell, "outline-none transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset")}>
      {body}
    </Link>
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
 * Parts of a whole as one thin bar, with a legend that names each part and its count (so colour is
 * never the only cue). Colours are the theme's chart-1/3/4, checked for colour-blind separation on white.
 */
export function SplitBar({ parts, label }: { parts: { label: string; value: number; color: string }[]; label: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0)
  return (
    <div className="space-y-2.5">
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={label}>
        {total > 0 &&
          parts.filter((p) => p.value > 0).map((p) => (
            <div key={p.label} className="h-full" style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
          ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full" style={{ background: p.color }} aria-hidden />
            {p.label} <span className="tabular-nums text-foreground">{p.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
