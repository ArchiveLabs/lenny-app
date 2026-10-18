/** @jest-environment node */
import { POST } from "./route"

const post = (headers: Record<string, string> = {}) => POST(new Request("http://admin.test/admin/api/auth/logout", { method: "POST", headers }))

it("refuses a logout that another site triggered", async () => {
  const res = await post({ origin: "http://evil.test", host: "admin.test" })
  expect(res.status).toBe(403)
  expect(res.cookies.getAll()).toEqual([])
})

it("clears the session cookies on both paths and is never cached", async () => {
  const res = await post({ origin: "http://admin.test", host: "admin.test" })
  expect(res.status).toBe(200)
  expect(res.headers.get("Cache-Control")).toBe("no-store")
  expect(res.headers.getSetCookie().filter((c) => c.startsWith("admin_token=;")).length).toBe(2)
})
