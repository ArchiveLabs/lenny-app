/** @jest-environment node */
process.env.LENNY_INTERNAL_API_URL = "http://lenny.test/v1/api"
process.env.ADMIN_INTERNAL_SECRET = "test-secret"
let token: string | undefined = "tok"
jest.mock("next/headers", () => ({ cookies: async () => ({ get: () => (token ? { value: token } : undefined) }) }))
const { POST } = require("./route")

const post = (headers: Record<string, string> = {}) => POST(new Request("http://admin.test/admin/api/auth/logout", { method: "POST", headers }))
const same = { origin: "http://admin.test", host: "admin.test" }

beforeEach(() => { token = "tok"; jest.restoreAllMocks() })

it("refuses a logout that another site triggered, and revokes nothing", async () => {
  const spy = jest.spyOn(global, "fetch")
  const res = await post({ origin: "http://evil.test", host: "admin.test" })
  expect(res.status).toBe(403)
  expect(res.headers.getSetCookie()).toEqual([])
  expect(spy).not.toHaveBeenCalled()
})

it("ends the session in Lenny first, then clears the cookies on both paths, uncached", async () => {
  const spy = jest.spyOn(global, "fetch").mockResolvedValue(new Response('{"ok":true}'))
  const res = await post(same)
  expect(res.status).toBe(200)
  expect(res.headers.get("Cache-Control")).toBe("no-store")
  const [url, init] = spy.mock.calls[0] as [string, any]
  expect(url).toBe("http://lenny.test/v1/api/admin/logout")
  expect(init).toMatchObject({ method: "POST", headers: { Authorization: "Bearer tok", "X-Admin-Internal-Secret": "test-secret" } })
  expect(res.headers.getSetCookie().filter((c: string) => c.startsWith("admin_token=;"))).toHaveLength(2)
})

it("still clears the cookies when Lenny can't be reached", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {})
  jest.spyOn(global, "fetch").mockRejectedValue(new Error("down"))
  const res = await post(same)
  expect(res.status).toBe(200)
  expect(res.headers.getSetCookie().filter((c: string) => c.startsWith("admin_token=;"))).toHaveLength(2)
})

it("doesn't call Lenny when there is no session", async () => {
  token = undefined
  const spy = jest.spyOn(global, "fetch")
  expect((await post(same)).status).toBe(200)
  expect(spy).not.toHaveBeenCalled()
})
