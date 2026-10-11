// @ts-nocheck
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { pollInterval, useImport } from "./use-import"
import { importApi } from "@/lib/import/api"

jest.mock("@/lib/import/api", () => ({ importApi: {} }))
jest.mock("@/lib/query-client", () => ({ forceFreshLibraryOnNextVisit: jest.fn() }))

const summary = (id: number, counts = {}) => ({
  id, created_at: "", expires_at: "", total: 1, counts, skipped: 0, encrypted: 0, ready: 0, auto_picked: 0,
})
const wrapper = ({ children }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}
const pick = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ file: new File(["x"], `b${i}.epub`), path: `L/b${i}.epub` }))

beforeEach(() => {
  Object.assign(importApi, {
    limits: jest.fn().mockResolvedValue({ max_rows_per_call: 500 }),
    listBatches: jest.fn().mockResolvedValue({ batches: [summary(7), summary(3)] }),
    batch: jest.fn().mockImplementation(async (id) => summary(id)),
    rows: jest.fn().mockResolvedValue({ rows: [], next_cursor: null }),
    createBatch: jest.fn().mockResolvedValue(summary(9)),
    putRows: jest.fn().mockResolvedValue({ created: 0, existing: 0 }),
    startMatch: jest.fn().mockResolvedValue({}),
    uploadFile: jest.fn().mockResolvedValue({ state: "imported" }),
  })
})

it("backs off polling", () => {
  expect([pollInterval(0), pollInterval(40), pollInterval(200)]).toEqual([2000, 5000, 10000])
})

it("resumes the newest batch after a reload", async () => {
  const { result } = renderHook(() => useImport({}), { wrapper })
  await waitFor(() => expect(result.current.batchId).toBe(7))
  await waitFor(() => expect(result.current.summary?.id).toBe(7))
})

it("saves rows 500 per call then starts matching", async () => {
  importApi.listBatches.mockResolvedValue({ batches: [] })
  const { result } = renderHook(() => useImport({}), { wrapper })
  await waitFor(() => expect(result.current.resumed).toBe(true))
  await act(() => result.current.addFiles(pick(1201)))
  expect(importApi.createBatch).toHaveBeenCalledTimes(1)
  expect(importApi.putRows.mock.calls.map((c) => c[1].length)).toEqual([500, 500, 201])
  expect(importApi.startMatch).toHaveBeenCalledWith(9)
  expect(result.current.phase.kind).toBe("idle")
})

it("imports only rows whose file is in memory and reports the rest as missing", async () => {
  importApi.listBatches.mockResolvedValue({ batches: [] })
  const { result } = renderHook(() => useImport({}), { wrapper })
  await waitFor(() => expect(result.current.resumed).toBe(true))
  const picked = pick(1)
  const f = picked[0].file
  await act(() => result.current.addFiles(picked))
  const mk = (id, path) => ({ id, path, size: 1, mtime: f.lastModified, state: "matched", decision: "auto" })
  importApi.rows.mockResolvedValue({ rows: [mk(1, "L/b0.epub"), mk(2, "L/gone.epub")], next_cursor: null })
  let res
  await act(async () => (res = await result.current.runImport()))
  expect(importApi.uploadFile).toHaveBeenCalledTimes(1)
  expect(importApi.uploadFile.mock.calls[0][1]).toBe(1)
  expect(res.missing).toBe(1)
})
