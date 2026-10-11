"use client"

import { Progress } from "@workspace/ui/components/progress"
import { Spinner } from "@workspace/ui/components/spinner"

export interface Stage {
  key: string
  label: string
  done: number
  total: number
  /** A quiet line under the bar. */
  hint?: string
}

const n = (v: number) => v.toLocaleString("en-US")

/** Everything that is working right now, in one place: reading, saving, matching and uploading. Hidden when idle. */
export function ProgressPanel({ stages }: { stages: Stage[] }) {
  if (!stages.length) return null
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3" aria-live="polite">
      {stages.map((s) => (
        <div key={s.key} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Spinner className="h-3.5 w-3.5 text-muted-foreground" role="presentation" aria-hidden />
              {s.label}
            </span>
            <span className="tabular-nums text-muted-foreground">{n(s.done)} / {n(s.total)}</span>
          </div>
          <Progress value={s.total ? Math.round((s.done / s.total) * 100) : 0} aria-label={s.label} className="h-1.5 bg-muted" />
          {s.hint && <p className="text-xs text-muted-foreground">{s.hint}</p>}
        </div>
      ))}
    </div>
  )
}
