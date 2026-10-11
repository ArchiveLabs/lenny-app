// updated_at has no timezone marker from the API; it is UTC.
export const toMs = (iso: string) => Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`)

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
]

/** "just now", "5 minutes ago", "2 hours ago", "3 days ago"; empty for a time that cannot be read. */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return ""
  const then = toMs(iso)
  if (!Number.isFinite(then)) return ""
  const diff = now - then
  if (diff < 60_000) return "just now"
  const [unit, ms] = UNITS.find(([, ms]) => diff >= ms)!
  return new Intl.RelativeTimeFormat("en", { numeric: "always" }).format(-Math.floor(diff / ms), unit)
}
