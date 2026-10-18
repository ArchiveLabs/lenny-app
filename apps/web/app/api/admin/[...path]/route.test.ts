/** @jest-environment node */
jest.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "old-token" }) }) }))

const upstream = (body: unknown, status = 200) =>
  jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }))

const put = (path: string) =>
  PUT(new Request(`http://admin.test/admin/api/admin/${path}`, { method: "PUT", body: "{}" }), { params: Promise.resolve({ path: path.split("/") }) })

// The route reads its env when it is first loaded, so set it first and load the route after.
process.env.LENNY_INTERNAL_API_URL = "http://lenny.test/v1/api"
const { PUT } = require("./route")

beforeEach(() => jest.restoreAllMocks())

it("keeps the new token in the cookie and out of the page's reach after a password change", async () => {
  upstream({ id: 1, username: "admin", token: "new-token" })
  const res = await put("librarians/1")
  expect(res.cookies.get("admin_token")?.value).toBe("new-token")
  expect(res.cookies.get("admin_token")?.httpOnly).toBe(true)
  expect(res.cookies.get("admin_token")?.path).toBe("/admin")
  // the stale broader-path cookie is expired in the same response
  expect(res.headers.getSetCookie()).toContainEqual(expect.stringMatching(/^admin_token=; Path=\/; Max-Age=0/))
  expect(await res.json()).toEqual({ id: 1, username: "admin" })
})

it("leaves the cookie alone when no token comes back", async () => {
  upstream({ id: 2, username: "ann" })
  const res = await put("librarians/2")
  expect(res.cookies.get("admin_token")).toBeUndefined()
})

const call = (path: string, init: RequestInit & { headers?: Record<string, string> } = {}) =>
  PUT(new Request(`http://admin.test/admin/api/admin/${path}`, { method: "PUT", body: "{}", ...init }), { params: Promise.resolve({ path: path.split("/") }) })

it("builds the upstream headers itself: nothing the page sends is forwarded", async () => {
  const spy = upstream({ ok: true })
  await call("librarians/2", { headers: { Cookie: "admin_token=stolen; other=1", "X-Admin-Internal-Secret": "forged", Authorization: "Bearer forged", "X-Forwarded-For": "1.2.3.4" } })
  const sent = (spy.mock.calls[0]![1] as any).headers as Record<string, string>
  expect(Object.keys(sent).map((k) => k.toLowerCase()).sort()).toEqual(["authorization", "content-type", "x-admin-internal-secret"].filter((k) => k in lower(sent)).sort())
  expect(sent.Authorization).toBe("Bearer old-token")
  expect(sent["X-Admin-Internal-Secret"]).not.toBe("forged")
})
const lower = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]))

it("answers 502 with a generic message and no detail when Lenny can't be reached", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {})
  jest.spyOn(global, "fetch").mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:1337"))
  const res = await call("librarians/2")
  expect(res.status).toBe(502)
  expect(res.headers.get("Cache-Control")).toBe("no-store")
  expect(JSON.stringify(await res.json())).not.toMatch(/10\.0\.0\.5|ECONNREFUSED/)
})

it("refuses a state-changing call from another site and a path that climbs out of /admin", async () => {
  expect((await call("librarians/2", { headers: { origin: "http://evil.test", host: "admin.test" } })).status).toBe(403)
  expect((await call("..")).status).toBe(400)
})
