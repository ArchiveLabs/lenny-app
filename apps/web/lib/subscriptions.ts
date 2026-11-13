import type { AccessMode } from "@/types/api"

// All user-facing naming for access modes and the Ghost screens lives here so it can be changed in one edit.
export const ACCESS_MODES: Record<AccessMode, { label: string; help: string }> = {
  open: { label: "Open", help: "Anyone can read it." },
  borrowable: { label: "Borrowable", help: "Patrons sign in and borrow a copy." },
  subscription: { label: "Subscription", help: "Only paid members of your Ghost site can read it." },
}

// The operator manual (arrives with ArchiveLabs/lenny#284).
export const SUBSCRIPTIONS_DOC = "https://github.com/ArchiveLabs/lenny/blob/main/docs/subscriptions.md"
export const WEBHOOKS_DOC = `${SUBSCRIPTIONS_DOC}#webhooks-end-access-when-a-member-cancels`

export const GHOST = {
  route: "/settings/ghost",
  title: "Ghost subscriptions",
  description: "Let paid members of your Ghost site read subscription books.",
} as const

export const DASHBOARD = {
  route: "/dashboard",
  title: "Dashboard",
} as const

export const STATS = {
  route: "/stats",
  title: "Subscription stats",
} as const

/** The Read button a publisher pastes into a Ghost post. The launch endpoint accepts the OL edition id as is. */
export const readButtonHtml = (olid: string) => `<button data-lenny-book="${olid}">Read</button>`

/** from/to as YYYY-MM-DD (UTC), the last `days` days including today. */
export function rangeFor(days: number, now = new Date()): { from: string; to: string } {
  const day = (d: Date) => d.toISOString().slice(0, 10)
  return { from: day(new Date(now.getTime() - (days - 1) * 86_400_000)), to: day(now) }
}

type Day = { date: string; books_read: number; patrons: number; opens: number }

/** Every day from `from` to `to`, with zeros for days the server left out, so the time axis has no gaps. */
export function fillDays(days: Day[], from: string, to: string): Day[] {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const out: Day[] = []
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10)
    out.push(byDate.get(date) ?? { date, books_read: 0, patrons: 0, opens: 0 })
  }
  return out
}

/** "Nov 13" for a YYYY-MM-DD day, read as UTC like the server writes it. */
export const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })

/** "in 5 h", "in 40 min", "now" until an ISO time; for a pass that ends soon. */
export function timeLeft(iso: string, now: number = Date.now()): string {
  const ms = Date.parse(iso) - now
  if (!Number.isFinite(ms) || ms <= 60_000) return "now"
  const minutes = Math.floor(ms / 60_000)
  return minutes < 60 ? `in ${minutes} min` : `in ${Math.floor(minutes / 60)} h`
}
