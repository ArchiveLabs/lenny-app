// @ts-nocheck
import { hasUnsafeSegment, isSameOrigin } from "./admin-guard"

// minimal stand-in so the test runs in any jest environment (jsdom has no Request)
const req = (headers: Record<string, string>) => ({ headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } }) as unknown as Request

describe("hasUnsafeSegment", () => {
  it.each([[[".."]], [["oauth2", "..", "x"]], [["."]], [["a/b"]], [["a\\b"]], [["a?x=1"]], [["a#b"]], [["a\u0000"]], [[""]]])(
    "rejects %j", (segs) => expect(hasUnsafeSegment(segs)).toBe(true))

  it("allows normal admin paths and client ids", () => {
    expect(hasUnsafeSegment(["oauth2", "clients", "my-app_1.0", "disable"])).toBe(false)
  })
})

describe("isSameOrigin", () => {
  it("allows requests without Origin", () => expect(isSameOrigin(req({}))).toBe(true))
  it("allows matching host", () => expect(isSameOrigin(req({ origin: "http://a.test", host: "a.test" }))).toBe(true))
  it("prefers x-forwarded-host", () =>
    expect(isSameOrigin(req({ origin: "http://a.test", host: "internal:3000", "x-forwarded-host": "a.test" }))).toBe(true))
  it("ignores ports (nginx forwards Host without one)", () =>
    expect(isSameOrigin(req({ origin: "http://a.test:8080", host: "a.test" }))).toBe(true))
  it("blocks Sec-Fetch-Site: cross-site even with a matching Origin", () =>
    expect(isSameOrigin(req({ origin: "http://a.test", host: "a.test", "sec-fetch-site": "cross-site" }))).toBe(false))
  it("blocks another origin", () => expect(isSameOrigin(req({ origin: "http://evil.test", host: "a.test" }))).toBe(false))
  it("blocks a malformed origin", () => expect(isSameOrigin(req({ origin: "null", host: "a.test" }))).toBe(false))
})

describe("pinned host", () => {
  afterEach(() => { delete process.env.ADMIN_PUBLIC_HOST })
  it("ignores a forged x-forwarded-host once the host is pinned", () => {
    process.env.ADMIN_PUBLIC_HOST = "admin.example"
    expect(isSameOrigin(req({ origin: "http://evil.test", host: "internal:3000", "x-forwarded-host": "evil.test" }))).toBe(false)
  })
  it("still allows the pinned host", () => {
    process.env.ADMIN_PUBLIC_HOST = "admin.example"
    expect(isSameOrigin(req({ origin: "https://admin.example", host: "internal:3000" }))).toBe(true)
  })
})

describe("unpinned host in production", () => {
  const env = process.env as Record<string, string | undefined>
  afterEach(() => { env.NODE_ENV = "test"; jest.restoreAllMocks(); jest.resetModules() })
  it("warns once that X-Forwarded-Host is being trusted", () => {
    jest.isolateModules(() => {
      env.NODE_ENV = "production"
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
      const { isSameOrigin: check } = require("./admin-guard")
      check(req({ origin: "http://a.test", host: "a.test" }))
      check(req({ origin: "http://a.test", host: "a.test" }))
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]![0]).toContain("ADMIN_PUBLIC_HOST")
    })
  })
})
