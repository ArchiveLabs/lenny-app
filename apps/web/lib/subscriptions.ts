import type { AccessMode } from "@/types/api"

// All user-facing naming for access modes and the Ghost screens lives here so it can be changed in one edit.
export const ACCESS_MODES: Record<AccessMode, { label: string; help: string }> = {
  open: { label: "Open", help: "Anyone can read it." },
  borrowable: { label: "Borrowable", help: "Patrons sign in and borrow a copy." },
  subscription: { label: "Subscription", help: "Only paid members of your Ghost site can read it." },
}

export const GHOST = {
  route: "/settings/ghost",
  title: "Ghost subscriptions",
  description: "Let paid members of your Ghost site read subscription books.",
} as const

export const STATS = {
  route: "/stats",
  title: "Reading stats",
} as const

/** The Read button a publisher pastes into a Ghost post. The launch endpoint accepts the OL edition id as is. */
export const readButtonHtml = (olid: string) => `<button data-lenny-book="${olid}">Read</button>`

/** from/to as YYYY-MM-DD (UTC), the last `days` days including today. */
export function rangeFor(days: number, now = new Date()): { from: string; to: string } {
  const day = (d: Date) => d.toISOString().slice(0, 10)
  return { from: day(new Date(now.getTime() - (days - 1) * 86_400_000)), to: day(now) }
}
