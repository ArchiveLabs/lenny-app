import type { ReactNode } from "react"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"

/** One headline number in the style of the shadcn dashboard block's section cards. */
export function KpiCard({ label, value, badge, footer, hint }: { label: string; value: ReactNode; badge?: ReactNode; footer?: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs dark:bg-card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
        {badge && <CardAction>{badge}</CardAction>}
      </CardHeader>
      {(footer || hint) && (
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {footer && <div className="line-clamp-1 flex items-center gap-2 font-medium">{footer}</div>}
          {hint && <div className="text-muted-foreground">{hint}</div>}
        </CardFooter>
      )}
    </Card>
  )
}

/** The grid the cards sit in: one column on phones, two on tablets, four on wide screens. */
export const KPI_GRID = "grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4"

/** A pulsing green dot: someone is reading right now. Still when the system asks for less motion. */
export function LiveDot() {
  return (
    <span className="relative flex size-2" aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-60 motion-reduce:animate-none" />
      <span className="relative inline-flex size-2 rounded-full bg-green-500" />
    </span>
  )
}
