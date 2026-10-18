/** @jest-environment node */
// @ts-nocheck
import { NextRequest } from "next/server"

process.env.LENNY_INTERNAL_API_URL = "http://lenny.test/v1/api"
process.env.ADMIN_INTERNAL_SECRET = "test-secret"
const { proxy, config } = require("./proxy")

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://admin.test${path}`, { headers: cookie ? { cookie: `admin_token=${cookie}` } : {} })
const verifyReturns = (status: number) => jest.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status }))

beforeEach(() => jest.restoreAllMocks())

it("exports its matcher as `config`, the name Next reads", () => {
  expect(config.matcher).toBeDefined()
})

it("sends a visitor with no cookie to the login page", async () => {
  const res = await proxy(req("/library"))
  expect(res.status).toBe(307)
  expect(res.headers.get("location")).toContain("/login?next=%2Flibrary")
})

it("asks Lenny to verify the token and sends a forged one to login, clearing both cookie paths", async () => {
  const spy = verifyReturns(401)
  const res = await proxy(req("/team", "forged"))
  expect(res.status).toBe(307)
  expect(res.headers.get("location")).toContain("/login")
  expect(res.headers.getSetCookie().filter((c) => c.startsWith("admin_token=;"))).toHaveLength(2)
  const [url, init] = spy.mock.calls[0]
  expect(url).toBe("http://lenny.test/v1/api/admin/verify")
  expect(init.headers.Authorization).toBe("Bearer forged")
})

it("lets a verified session through, uncached", async () => {
  verifyReturns(200)
  const res = await proxy(req("/team", "good"))
  expect(res.status).toBe(200)
  expect(res.headers.get("Cache-Control")).toContain("no-store")
})

it("doesn't turn a Lenny outage into a lockout", async () => {
  jest.spyOn(global, "fetch").mockRejectedValue(new Error("down"))
  expect((await proxy(req("/team", "good"))).status).toBe(200)
})

it("leaves the API routes to check the token upstream, with no extra call", async () => {
  const spy = verifyReturns(401)
  await proxy(req("/api/admin/me", "forged"))
  expect(spy).not.toHaveBeenCalled()
})

it.each(["/api/auth", "/api/auth/logout"])("keeps %s reachable without a session", async (path) => {
  expect((await proxy(req(path))).status).toBe(200)
})

it("does not let a path that ends in .json skip the session check on an API route", async () => {
  expect((await proxy(req("/api/admin/x.json"))).status).toBe(401)
})
