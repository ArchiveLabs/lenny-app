import { relativeTime, toMs } from "./time"

const NOW = Date.parse("2026-10-11T12:00:00Z")
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe("relativeTime", () => {
  it("says just now under a minute", () => expect(relativeTime(ago(20_000), NOW)).toBe("just now"))
  it("counts minutes, hours and days", () => {
    expect(relativeTime(ago(5 * 60_000), NOW)).toBe("5 minutes ago")
    expect(relativeTime(ago(60_000), NOW)).toBe("1 minute ago")
    expect(relativeTime(ago(3 * 3_600_000), NOW)).toBe("3 hours ago")
    expect(relativeTime(ago(2 * 86_400_000), NOW)).toBe("2 days ago")
  })
  it("rounds down, so 119 minutes is 1 hour", () => expect(relativeTime(ago(119 * 60_000), NOW)).toBe("1 hour ago"))
  it("is empty for nothing or a time that cannot be read", () => {
    expect(relativeTime(null, NOW)).toBe("")
    expect(relativeTime(undefined, NOW)).toBe("")
    expect(relativeTime("not a time", NOW)).toBe("")
  })
  it("treats a time with no zone as UTC", () => {
    expect(relativeTime("2026-10-11T11:55:00", NOW)).toBe("5 minutes ago")
    expect(toMs("2026-10-11T11:55:00")).toBe(Date.parse("2026-10-11T11:55:00Z"))
  })
  it("keeps an explicit offset", () => expect(toMs("2026-10-11T13:55:00+02:00")).toBe(Date.parse("2026-10-11T11:55:00Z")))
})
