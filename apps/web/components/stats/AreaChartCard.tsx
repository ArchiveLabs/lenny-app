"use client"

import { useId, type ReactNode } from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { useTranslation } from "react-i18next"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart"
import { cn } from "@workspace/ui/lib/utils"
import { byWeek, dayLabel } from "@/lib/subscriptions"

export const RANGES = [90, 30, 7] as const
const RANGE_SHORT: Record<number, string> = { 90: "3 months", 30: "30 days", 7: "7 days" }
const RANGE_PHRASE: Record<number, string> = { 90: "in the last 3 months", 30: "in the last 30 days", 7: "in the last 7 days" }

/**
 * One daily series as an area chart: the period's total is the headline, a quiet text switch picks the
 * period. Three months are drawn per week, so a few busy days read as a trend instead of needles.
 */
export function AreaChartCard({
  title,
  label,
  data,
  days,
  onDays,
  children,
}: {
  title: string
  label: string
  data: { date: string; value: number }[]
  days: number
  onDays: (days: number) => void
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const fill = `fill-${useId().replace(/:/g, "")}`
  const config: ChartConfig = { value: { label: t(label), color: "var(--chart-1)" } }
  const weekly = days > 31
  const points = weekly ? byWeek(data) : data
  const total = data.reduce((n, d) => n + d.value, 0)
  return (
    <section className="@container/card rounded-xl border bg-card" aria-label={title}>
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
        <div>
          <h2 className="text-sm text-muted-foreground">{title}</h2>
          <p className="mt-1 text-2xl font-medium tracking-tight">
            <span className="tabular-nums">{total.toLocaleString()}</span>{" "}
            <span className="text-muted-foreground">{t(RANGE_PHRASE[days] ?? "")}</span>
          </p>
        </div>
        <div role="radiogroup" aria-label={t("Period")} className="flex gap-4 text-sm">
          {RANGES.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={days === d}
              onClick={() => onDays(d)}
              className={cn(
                "-mb-px border-b-2 pb-1 outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                days === d ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(RANGE_SHORT[d]!)}
            </button>
          ))}
        </div>
      </div>
      <div className="px-2 pt-6 pb-4 sm:px-4">
        <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
          <AreaChart data={points} margin={{ left: 12, right: 12 }}>
            <defs>
              <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="2 4" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} minTickGap={40} tickFormatter={dayLabel} />
            <ChartTooltip
              cursor={{ stroke: "var(--border)" }}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const date = String(payload?.[0]?.payload?.date ?? "")
                    return weekly ? t("Week of {{day}}", { day: dayLabel(date) }) : dayLabel(date)
                  }}
                  indicator="line"
                />
              }
            />
            <Area dataKey="value" type="monotone" fill={`url(#${fill})`} stroke="var(--color-value)" strokeWidth={1.75} activeDot={{ r: 4, strokeWidth: 0 }} />
          </AreaChart>
        </ChartContainer>
        {weekly && <p className="px-3 text-xs text-muted-foreground">{t("Each point is one week.")}</p>}
        {children && <div className="px-3">{children}</div>}
      </div>
    </section>
  )
}
