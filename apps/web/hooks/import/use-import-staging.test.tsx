// @ts-nocheck
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useImport } from "./use-import"
import { importApi } from "@/lib/import/api"
import { importFiles } from "@/lib/import/files"

jest.mock("@/lib/import/api", () => ({ importApi: {} }))
jest.mock("@/lib/query-client", () => ({ forceFreshLibraryOnNextVisit: jest.fn() }))

const row = (id, over = {}) => ({
  id, path: `L/b${id}.epub`, size: 1, mtime: 1000, state: "matched", decision: "auto", skipped: false, staged: false, ...over,
})
const fileFor = (id) => ({ file: new File(["x"], `b${id}.epub`, { lastModified: 1000 }), path: `L/b${id}.epub` })
const batch = (over = {}) => ({
  id: 7, created_at: "", expires_at: "", total: 5, counts: { matched: 5 }, skipped: 0, encrypted: 0,
  ready: 5, auto_picked: 5, staged: 0, unstaged: 5, ...over,
})
const mount = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderHook(() => useImport({}), { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> })
}
const attach = (...ids) => ids.forEach((id) => { const p = fileFor(id); importFiles.add(p.file, p.path) })

beforeEach(() => {
  jest.clearAllMocks()
  importFiles.clear()
  Object.assign(importApi, {
    limits: jest.fn().mockResolvedValue({ max_rows_per_call: 500 }),
    listBatches: jest.fn().mockResolvedValue({ batches: [batch()] }),
    batch: jest.fn().mockResolvedValue(batch()),
    rows: jest.fn().mockResolvedValue({ rows: [1, 2, 3, 4, 5].map((i) => row(i)), next_cursor: null }),
    stageFile: jest.fn().mockResolvedValue({ staged: true }),
    importRow: jest.fn().mockResolvedValue({ state: "imported" }),
    startMatch: jest.fn().mockResolvedValue({}),
  })
})

it("sends matched rows' files to the server in the background, three at a time, without importing", async () => {
  attach(1, 2, 3, 4, 5)
  let live = 0
  let peak = 0
  importApi.stageFile.mockImplementation(async () => {
    peak = Math.max(peak, ++live)
    await new Promise((ok) => setTimeout(ok, 10))
    live--
    return { staged: true }
  })
  mount()
  await waitFor(() => expect(importApi.stageFile).toHaveBeenCalledTimes(5))
  expect(peak).toBeLessThanOrEqual(3)
  expect(importApi.importRow).not.toHaveBeenCalled()
})

it("does not resend rows already on the server or with no file here", async () => {
  attach(1, 3)
  importApi.rows.mockImplementation(async (_id, f) => ({
    rows: [row(1, { staged: true }), row(3), row(4)].filter((r) => f.staged === undefined || r.staged === f.staged), // 4 has no file in memory
    next_cursor: null,
  }))
  mount()
  await waitFor(() => expect(importApi.stageFile).toHaveBeenCalledTimes(1))
  expect(importApi.stageFile.mock.calls[0][1]).toBe(3)
  // Only rows still to be sent are requested, and the pass does not depend on the skipped flag.
  expect(importApi.rows).toHaveBeenCalledWith(7, expect.objectContaining({ state: "matched", staged: false }))
  expect(importApi.rows.mock.calls.some(([, f]) => f.staged === false && "skipped" in f)).toBe(false)
})

it("retries a failing upload, then stops and reports it until the admin tries again", async () => {
  attach(1)
  importApi.rows.mockResolvedValue({ rows: [row(1)], next_cursor: null })
  importApi.stageFile.mockRejectedValue(new Error("network down"))
  const { result } = mount()
  await waitFor(() => expect(result.current.uploadFailed).toBe(1), { timeout: 4000 })
  expect(importApi.stageFile).toHaveBeenCalledTimes(3) // first try plus two retries
  await new Promise((ok) => setTimeout(ok, 300))
  expect(importApi.stageFile).toHaveBeenCalledTimes(3) // no loop

  importApi.stageFile.mockResolvedValue({ staged: true })
  await act(async () => result.current.retryUploads())
  await waitFor(() => expect(importApi.stageFile).toHaveBeenCalledTimes(4))
  await waitFor(() => expect(result.current.uploadFailed).toBe(0))
})

it("imports staged rows on the server with no file in memory and nothing to reconnect", async () => {
  importApi.batch.mockResolvedValue(batch({ staged: 5, unstaged: 0 }))
  importApi.rows.mockResolvedValue({ rows: [1, 2].map((i) => row(i, { staged: true })), next_cursor: null })
  const { result } = mount()
  await waitFor(() => expect(result.current.summary?.staged).toBe(5))
  let res
  await act(async () => (res = await result.current.runImport()))
  expect(importApi.stageFile).not.toHaveBeenCalled() // no bytes move
  expect(importApi.importRow.mock.calls.map((c) => c[1])).toEqual([1, 2])
  expect(res).toEqual({ missing: 0, failed: 0 })
})

it("uploads a row that is not staged yet before importing it", async () => {
  attach(1)
  importApi.batch.mockResolvedValue(batch({ unstaged: 0 })) // keep the background pass out of the way
  importApi.rows.mockResolvedValue({ rows: [row(1)], next_cursor: null })
  const { result } = mount()
  await waitFor(() => expect(result.current.summary?.id).toBe(7))
  await act(async () => { await result.current.runImport() })
  expect(importApi.stageFile.mock.invocationCallOrder[0]).toBeLessThan(importApi.importRow.mock.invocationCallOrder[0])
})

it("counts as missing only rows with no file on the server and none in memory", async () => {
  importApi.batch.mockResolvedValue(batch({ staged: 1, unstaged: 1 }))
  importApi.rows.mockResolvedValue({ rows: [row(1, { staged: true }), row(2)], next_cursor: null })
  const { result } = mount()
  await waitFor(() => expect(result.current.missing).toBe(1)) // row 2 only
})

it("does not warn on leaving once everything is on the server", async () => {
  attach(1)
  const add = jest.spyOn(window, "addEventListener")
  importApi.batch.mockResolvedValue(batch({ staged: 5, unstaged: 0 }))
  mount()
  await waitFor(() => expect(importApi.batch).toHaveBeenCalled())
  await new Promise((ok) => setTimeout(ok, 50))
  expect(add.mock.calls.some(([t]) => t === "beforeunload")).toBe(false)
  add.mockRestore()
})
