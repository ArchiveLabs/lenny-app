"use client"

import { useId, type ReactNode } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart"
import { byWeek, dayLabel } from "@/lib/subscriptions"
import { Panel, Segmented } from "./ui"

export const RANGES = [90, 30, 7] as const
const RANGE_SHORT: Record<number, string> = { 90: "3M", 30: "1M", 7: "1W" }

/** A dashed series is drawn as a line on top, so it stays visible where it matches the filled one. */
export type Series = { key: string; label: string; color: string; dashed?: boolean }

/**
 * Daily series as overlaid areas in a panel: a legend that carries each series' total, a y-axis with
 * dashed grid lines, a crosshair tooltip, and an optional strip of figures along the bottom. Three
 * months are drawn per week, so a few busy days read as a trend instead of needles.
 */
export function AreaChartCard({
  icon,
  title,
  description,
  series,
  data,
  days,
  onDays,
  summary,
  children,
}: {
  icon: LucideIcon
  title: string
  description?: string
  series: Series[]
  data: ({ date: string } & Record<string, number | string>)[]
  days: number
  onDays: (days: number) => void
  summary?: { label: string; value: ReactNode }[]
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const id = useId().replace(/:/g, "")
  const weekly = days > 31
  const points = weekly ? byWeek(data) : data
  const config: ChartConfig = Object.fromEntries(series.map((s) => [s.key, { label: t(s.label), color: s.color }]))
  const total = (key: string) => data.reduce((n, d) => n + Number(d[key] ?? 0), 0)

  return (
    <Panel
      icon={icon}
      title={title}
      description={description ?? (weekly ? t("Per week") : t("Per day"))}
      action={<Segmented label={t("Period")} value={days} onChange={onDays} options={RANGES.map((d) => ({ value: d, label: RANGE_SHORT[d]! }))} />}
    >
      <ul className="flex flex-wrap gap-x-6 gap-y-1 px-5 pt-5">
        {series.map((s) => (
          <li key={s.key} className="flex items-baseline gap-2">
            {s.dashed ? (
              <span className="w-3 self-center border-t-2 border-dashed" style={{ borderColor: s.color }} aria-hidden />
            ) : (
              <span className="size-2 self-center rounded-full" style={{ background: s.color }} aria-hidden />
            )}
            <span className="text-sm text-muted-foreground">{t(s.label)}</span>
            <span className="text-xl font-semibold tracking-tight tabular-nums">{total(s.key).toLocaleString()}</span>
          </li>
        ))}
      </ul>

      <div className="px-2 pt-4 pb-3 sm:px-3">
        <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
          <AreaChart data={points} margin={{ left: 0, right: 12, top: 4 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`var(--color-${s.key})`} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={`var(--color-${s.key})`} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 4" />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={36} tickMargin={6} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} minTickGap={40} tickFormatter={dayLabel} />
            <ChartTooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3", strokeOpacity: 0.6 }}
              content={
                <ChartTooltipContent
                  className="min-w-40"
                  labelFormatter={(_, payload) => {
                    const date = String(payload?.[0]?.payload?.date ?? "")
                    return weekly ? t("Week of {{day}}", { day: dayLabel(date) }) : dayLabel(date)
                  }}
                  indicator="dot"
                />
              }
            />
            {[...series].sort((a, b) => Number(!!a.dashed) - Number(!!b.dashed)).map((s) => (
              <Area
                key={s.key}
                dataKey={s.key}
                type="monotone"
                fill={s.dashed ? "none" : `url(#${id}-${s.key})`}
                stroke={`var(--color-${s.key})`}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              />
            ))}
          </AreaChart>
        </ChartContainer>
        {children && <div className="px-3">{children}</div>}
      </div>

      {summary && (
        <dl className="mt-auto grid grid-cols-2 border-t @2xl/main:grid-cols-4">
          {summary.map((s, i) => (
            <div key={s.label} className={i > 0 ? "border-l px-5 py-4 max-@2xl/main:[&:nth-child(3)]:border-l-0 max-@2xl/main:[&:nth-child(n+3)]:border-t" : "px-5 py-4"}>
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="mt-1 font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  )
}
