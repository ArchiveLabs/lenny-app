/** @jest-environment node */
// @ts-nocheck
import { importApi } from "./api"
import { fetchAdmin } from "@/lib/api-client"

jest.mock("@/lib/api-client", () => ({
  ...jest.requireActual("@/lib/api-client"),
  fetchAdmin: jest.fn(),
}))

const ok = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))

beforeEach(() => (fetchAdmin as jest.Mock).mockReset())

it("sends row filters as a query string and drops empty ones", async () => {
  ;(fetchAdmin as jest.Mock).mockReturnValue(ok({ rows: [], next_cursor: null }))
  await importApi.rows(3, { state: "no_match", q: "", skipped: false, cursor: "c1" })
  expect(fetchAdmin).toHaveBeenCalledWith("import/batches/3/rows?state=no_match&skipped=false&cursor=c1&limit=100")
})

it("filters rows by staged", async () => {
  ;(fetchAdmin as jest.Mock).mockReturnValue(ok({ rows: [], next_cursor: null }))
  await importApi.rows(3, { state: "matched", skipped: false, staged: false })
  expect(fetchAdmin).toHaveBeenCalledWith("import/batches/3/rows?state=matched&skipped=false&staged=false&limit=100")
})

it("PUTs rows as JSON", async () => {
  ;(fetchAdmin as jest.Mock).mockReturnValue(ok({ created: 1, existing: 0 }))
  await importApi.putRows(1, [{ path: "a.epub", size: 1, mtime: 2 }])
  const [path, init] = (fetchAdmin as jest.Mock).mock.calls[0]
  expect(path).toBe("import/batches/1/rows")
  expect(init.method).toBe("PUT")
  expect(JSON.parse(init.body).rows).toHaveLength(1)
})

it("uploads the file as multipart field 'file'", async () => {
  ;(fetchAdmin as jest.Mock).mockReturnValue(
    ok({ id: 5, path: "a.epub", size: 1, mtime: 2, state: "imported", decision: "auto" }),
  )
  const row = await importApi.uploadFile(1, 5, new Blob(["x"]))
  const [path, init] = (fetchAdmin as jest.Mock).mock.calls[0]
  expect(path).toBe("import/batches/1/rows/5/file")
  expect(init.body.get("file")).toBeTruthy()
  expect(row.state).toBe("imported")
})

it("surfaces API errors", async () => {
  ;(fetchAdmin as jest.Mock).mockReturnValue(ok({ detail: "Batch expired" }, 410))
  await expect(importApi.batch(1)).rejects.toThrow("Batch expired")
})

it("DELETEs a single row and returns the updated batch", async () => {
  ;(fetchAdmin as jest.Mock).mockReturnValue(ok({ id: 3, created_at: "t", expires_at: "t", total: 1, counts: {} }))
  expect((await importApi.removeRow(3, 9)).total).toBe(1)
  expect(fetchAdmin).toHaveBeenCalledWith("import/batches/3/rows/9", { method: "DELETE" })
})

it("stages a file with PUT multipart and imports a staged row with a bodyless POST", async () => {
  const row = { id: 9, path: "a.epub", size: 1, mtime: 1, state: "matched", decision: "auto", staged: true }
  ;(fetchAdmin as jest.Mock).mockReturnValue(ok(row))
  expect((await importApi.stageFile(3, 9, new Blob(["x"]))).staged).toBe(true)
  const [path, init] = (fetchAdmin as jest.Mock).mock.calls[0]
  expect(path).toBe("import/batches/3/rows/9/staged")
  expect(init.method).toBe("PUT")
  expect(init.body.get("file")).toBeTruthy()

  ;(fetchAdmin as jest.Mock).mockReturnValue(ok({ ...row, state: "imported", staged: false }))
  await importApi.importRow(3, 9)
  expect((fetchAdmin as jest.Mock).mock.calls[1]).toEqual(["import/batches/3/rows/9/import", { method: "POST" }])
})

it("searches editions for a row with the text encoded", async () => {
  ;(fetchAdmin as jest.Mock).mockReturnValue(ok({ candidates: [{ olid: 1, title: "T", in_library: true }] }))
  const res = await importApi.searchEditions(3, 9, "dune & co")
  expect(fetchAdmin).toHaveBeenCalledWith("import/batches/3/rows/9/search?q=dune+%26+co")
  expect(res.candidates[0].in_library).toBe(true)
})

it("asks for a page by offset and limit", async () => {
  ;(fetchAdmin as jest.Mock).mockReturnValue(ok({ rows: [], next_cursor: null, total: 120 }))
  const page = await importApi.rows(3, { state: "matched", offset: 100, limit: 50 })
  expect(fetchAdmin).toHaveBeenCalledWith("import/batches/3/rows?state=matched&offset=100&limit=50")
  expect(page.total).toBe(120)
})
