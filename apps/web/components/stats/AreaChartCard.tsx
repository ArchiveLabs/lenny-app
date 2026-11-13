"use client"

import { useId, type ReactNode } from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { useTranslation } from "react-i18next"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { NativeSelect } from "@/components/NativeSelect"
import { dayLabel } from "@/lib/subscriptions"

export const RANGES = [90, 30, 7] as const
const RANGE_LABEL: Record<number, string> = { 90: "Last 3 months", 30: "Last 30 days", 7: "Last 7 days" }

/**
 * One daily series as an area chart with a period switch, after the shadcn interactive area chart:
 * a toggle on wide cards, the native select on narrow ones.
 */
export function AreaChartCard({
  title,
  description,
  label,
  data,
  days,
  onDays,
  children,
}: {
  title: string
  description?: string
  label: string
  data: { date: string; value: number }[]
  days: number
  onDays: (days: number) => void
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const fill = `fill-${useId().replace(/:/g, "")}`
  const config: ChartConfig = { value: { label: t(label), color: "var(--chart-1)" } }
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description ?? t(RANGE_LABEL[days] ?? "")}</CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-label={t("Period")}
            value={String(days)}
            onValueChange={(v) => v && onDays(Number(v))} // keep one period picked
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            {RANGES.map((d) => (
              <ToggleGroupItem key={d} value={String(d)}>{t(RANGE_LABEL[d]!)}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          <NativeSelect aria-label={t("Period")} value={days} onChange={(e) => onDays(Number(e.target.value))} className="h-8 w-40 text-sm @[767px]/card:hidden">
            {RANGES.map((d) => (
              <option key={d} value={d}>{t(RANGE_LABEL[d]!)}</option>
            ))}
          </NativeSelect>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={config} className="aspect-auto h-[250px] w-full">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={dayLabel} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => dayLabel(String(v))} indicator="dot" />} />
            <Area dataKey="value" type="monotone" fill={`url(#${fill})`} stroke="var(--color-value)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
        {children}
      </CardContent>
    </Card>
  )
}
