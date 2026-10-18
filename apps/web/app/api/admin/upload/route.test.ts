/** @jest-environment node */
process.env.LENNY_INTERNAL_API_URL = "http://lenny.test/v1/api"
const { POST } = require("./route")

jest.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "tok" }) }) }))

const upload = (headers: Record<string, string>) =>
  POST(new Request("http://admin.test/admin/api/admin/upload", { method: "POST", headers: { host: "admin.test", ...headers }, body: "x" }))

beforeEach(() => jest.restoreAllMocks())

it("only takes multipart uploads, and says so without caching", async () => {
  const res = await upload({ "content-type": "application/json" })
  expect(res.status).toBe(415)
  expect(res.headers.get("Cache-Control")).toBe("no-store")
})

it("refuses a file over 100 MB before streaming any of it", async () => {
  const spy = jest.spyOn(global, "fetch")
  const res = await upload({ "content-type": "multipart/form-data; boundary=x", "content-length": String(101 * 1024 * 1024) })
  expect(res.status).toBe(413)
  expect(spy).not.toHaveBeenCalled()
})

it("refuses an upload another site triggered", async () => {
  expect((await upload({ "content-type": "multipart/form-data; boundary=x", origin: "http://evil.test" })).status).toBe(403)
})

it("marks Lenny's answer no-store", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 200 }))
  const res = await upload({ "content-type": "multipart/form-data; boundary=x", "content-length": "10" })
  expect(res.headers.get("Cache-Control")).toBe("no-store")
})
