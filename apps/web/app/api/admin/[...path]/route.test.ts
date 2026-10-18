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
  expect(await res.json()).toEqual({ id: 1, username: "admin" })
})

it("leaves the cookie alone when no token comes back", async () => {
  upstream({ id: 2, username: "ann" })
  const res = await put("librarians/2")
  expect(res.cookies.get("admin_token")).toBeUndefined()
})
