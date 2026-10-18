/** @jest-environment node */
// @ts-nocheck
// The route reads its env when it is first loaded, so set it first and load the route after.
process.env.LENNY_INTERNAL_API_URL = "http://lenny.test/v1/api"
process.env.ADMIN_INTERNAL_SECRET = "test-secret"
const { POST } = require("./route")

const login = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request("http://admin.test/admin/api/auth", { method: "POST", headers: { host: "admin.test", ...headers }, body: JSON.stringify(body) }))
const upstream = (body: unknown, status = 200) =>
  jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }))

beforeEach(() => jest.restoreAllMocks())

it("refuses a login another site triggered", async () => {
  const res = await login({ username: "a", password: "b" }, { origin: "http://evil.test" })
  expect(res.status).toBe(403)
})

it("sets a scoped httpOnly session cookie, keeps the token out of the body and is never cached", async () => {
  upstream({ token: "tok", username: "admin", display_name: "Ann" })
  const res = await login({ username: "admin", password: "pw" }, { origin: "http://admin.test" })
  expect(res.status).toBe(200)
  expect(res.headers.get("Cache-Control")).toBe("no-store")
  expect(JSON.stringify(await res.json())).not.toContain("tok")
  const cookies = res.headers.getSetCookie()
  const token = cookies.find((c) => c.startsWith("admin_token="))!
  expect(token).toMatch(/HttpOnly/i)
  expect(token).toMatch(/Path=\/admin/)
  expect(token).toMatch(/SameSite=strict/i)
  expect(cookies.find((c) => c.startsWith("admin_user="))).toContain("Ann")
  // a cookie from before the /admin scope must not linger beside the new one
  expect(cookies).toContainEqual(expect.stringMatching(/^admin_token=; Path=\/; Max-Age=0/))
})

it("says plainly when there have been too many attempts", async () => {
  upstream({ detail: "locked" }, 429)
  const res = await login({ username: "a", password: "b" })
  expect(res.status).toBe(429)
  expect((await res.json()).error).toBe("Too many attempts, try again in a few minutes.")
})

it("sends the secret to Lenny only, and a bad login gets only Lenny's message", async () => {
  const spy = upstream({ detail: "Invalid email, username or password." }, 401)
  const res = await login({ username: "a", password: "b" })
  expect(res.status).toBe(401)
  expect((await res.json()).error).toBe("Invalid email, username or password.")
  expect((spy.mock.calls[0]![1] as any).headers["X-Admin-Internal-Secret"]).toBe("test-secret")
})

it("refuses non-string or oversized credentials before they reach Lenny", async () => {
  const spy = jest.spyOn(global, "fetch")
  const ok = { origin: "http://admin.test" }
  expect((await login({ username: { $ne: 1 }, password: "pw" }, ok)).status).toBe(400)
  expect((await login({ username: "a", password: ["x"] }, ok)).status).toBe(400)
  expect((await login({ username: "a", password: "x".repeat(1025) }, ok)).status).toBe(400)
  expect(spy).not.toHaveBeenCalled()
})

it("never passes a non-string upstream error to the page", async () => {
  upstream({ detail: [{ msg: "bad", loc: ["body"] }] }, 422)
  const res = await login({ username: "a", password: "pw" }, { origin: "http://admin.test" })
  expect(typeof (await res.json()).error).toBe("string")
})
