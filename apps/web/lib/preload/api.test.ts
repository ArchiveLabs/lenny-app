/** @jest-environment node */
// @ts-nocheck
import { preloadApi } from "./api"
import { fetchAdmin } from "@/lib/api-client"

jest.mock("@/lib/api-client", () => ({ ...jest.requireActual("@/lib/api-client"), fetchAdmin: jest.fn() }))
const ok = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))
beforeEach(() => fetchAdmin.mockReset())

it("sends only the set filters and keeps hide_owned only when true", async () => {
  fetchAdmin.mockImplementation(() => ok({ books: [], total: 0, available: 0 }))
  await preloadApi.catalog({ q: "austen", collection: "", hide_owned: true, cursor: "c" })
  expect(fetchAdmin).toHaveBeenCalledWith("preload/catalog?q=austen&hide_owned=true&cursor=c")
  await preloadApi.catalog({ hide_owned: false })
  expect(fetchAdmin).toHaveBeenLastCalledWith("preload/catalog")
})

it("posts the import body as JSON and reads the counts", async () => {
  fetchAdmin.mockReturnValue(ok({ queued: 2, already_in_library: 1, unknown: ["x/y"], size: 10 }, 202))
  const res = await preloadApi.importBooks({ olids: [1, 2] })
  const [path, init] = fetchAdmin.mock.calls[0]
  expect(path).toBe("preload/import")
  expect(JSON.parse(init.body)).toEqual({ olids: [1, 2] })
  expect(res).toMatchObject({ queued: 2, already_in_library: 1, unknown: ["x/y"] })
})

it("surfaces a load already running", async () => {
  fetchAdmin.mockReturnValue(ok({ detail: "A load is already running" }, 409))
  await expect(preloadApi.importBooks({ collection: "poetry" })).rejects.toThrow("A load is already running")
})

it("asks for the newest first and for only new books", async () => {
  ;(fetchAdmin as jest.Mock).mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ books: [], total: 0, available: 0 }), { status: 200 })))
  await preloadApi.catalog({ sort: "added_desc", new_only: true })
  expect(fetchAdmin).toHaveBeenCalledWith("preload/catalog?sort=added_desc&new_only=true")
})

it("checks archive.org now", async () => {
  ;(fetchAdmin as jest.Mock).mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ started: false }), { status: 202 })))
  expect(await preloadApi.refresh()).toEqual({ started: false })
  expect((fetchAdmin as jest.Mock).mock.calls.at(-1)).toEqual(["preload/refresh", { method: "POST" }])
})
