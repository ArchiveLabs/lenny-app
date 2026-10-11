import Link from "next/link"
import { ChevronRight } from "lucide-react"

export interface Source {
  title: string
  description: string
  href?: string // no href = not available yet
  icon: React.ReactNode
}

export function SourceList({ sources }: { sources: Source[] }) {
  return (
    <ul className="max-w-4xl divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
      {sources.map((s) => {
        const body = (
          <>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">{s.icon}</div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{s.title}</p>
              <p className="text-sm text-muted-foreground">{s.description}</p>
            </div>
            {s.href && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />}
          </>
        )
        return (
          <li key={s.title}>
            {s.href ? (
              <Link href={s.href} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50">{body}</Link>
            ) : (
              <div aria-disabled="true" className="flex items-center gap-4 px-5 py-4 opacity-60">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
