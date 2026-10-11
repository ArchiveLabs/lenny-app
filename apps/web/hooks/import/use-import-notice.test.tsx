// @ts-nocheck
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useImport } from "./use-import"
import { importApi } from "@/lib/import/api"
import { importFiles } from "@/lib/import/files"

jest.mock("@/lib/import/api", () => ({ importApi: {} }))
jest.mock("@/lib/query-client", () => ({ forceFreshLibraryOnNextVisit: jest.fn() }))

const mk = (id, over = {}) => ({ id, path: `L/b${id}.epub`, size: 1, mtime: 1000, state: "matched", decision: "auto", skipped: false, staged: false, ...over })
const drop = (...ids) => ids.map((id) => ({ file: new File(["x"], `b${id}.epub`, { lastModified: 1000 }), path: `L/b${id}.epub` }))
const batch = { id: 7, created_at: "", expires_at: "", total: 3, counts: {}, skipped: 0, encrypted: 0, ready: 0, auto_picked: 0, staged: 0, unstaged: 0 }

const setup = async (rows) => {
  importApi.rows.mockImplementation(async (_id, f) => ({
    rows: rows.filter((r) => (f.state === undefined || r.state === f.state) && (f.skipped === undefined || r.skipped === f.skipped)),
    next_cursor: null,
  }))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = renderHook(() => useImport({}), { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> })
  await waitFor(() => expect(view.result.current.batchId).toBe(7))
  return view.result
}

beforeEach(() => {
  jest.clearAllMocks()
  importFiles.clear()
  Object.assign(importApi, {
    limits: jest.fn().mockResolvedValue({ max_rows_per_call: 500 }),
    listBatches: jest.fn().mockResolvedValue({ batches: [batch] }),
    batch: jest.fn().mockResolvedValue(batch),
    rows: jest.fn(),
    putRows: jest.fn().mockImplementation(async (_id, rows) => ({ created: rows.length, existing: 0, existing_states: {} })),
    startMatch: jest.fn().mockResolvedValue({}),
  })
})

it("says the files are already in the list when dropped again", async () => {
  const result = await setup([mk(1, { staged: true }), mk(2, { staged: true })])
  await act(() => result.current.addFiles(drop(1, 2)))
  expect(result.current.notice).toBe("These 2 files are already in your list")
  expect(importApi.putRows).not.toHaveBeenCalled()
})

it("uses the singular for one file", async () => {
  const result = await setup([mk(1, { staged: true })])
  await act(() => result.current.addFiles(drop(1)))
  expect(result.current.notice).toBe("This file is already in your list")
})

it("adds how many were already imported", async () => {
  const result = await setup([mk(1, { state: "imported" }), mk(2, { staged: true }), mk(3, { state: "imported" })])
  await act(() => result.current.addFiles(drop(1, 2, 3)))
  expect(result.current.notice).toBe("These 3 files are already in your list (2 already imported)")
})

it("says how many were added and how many were already there", async () => {
  const result = await setup([mk(1, { staged: true })])
  await act(() => result.current.addFiles(drop(1, 2, 3)))
  expect(result.current.notice).toBe("Added 2 new books. 1 was already in your list")
})

it("adds up the chunks before saying how many were added", async () => {
  importApi.limits.mockResolvedValue({ max_rows_per_call: 2 })
  const result = await setup([mk(1, { staged: true })])
  await act(() => result.current.addFiles(drop(1, 2, 3, 4, 5)))
  expect(importApi.putRows).toHaveBeenCalledTimes(2)
  expect(result.current.notice).toBe("Added 4 new books. 1 was already in your list")
})

it("shows no notice when everything is new", async () => {
  const result = await setup([])
  await act(() => result.current.addFiles(drop(1, 2)))
  expect(result.current.notice).toBeNull()
})

it("only says Reconnected, not already in your list, when the rows just needed their files", async () => {
  const result = await setup([mk(1), mk(2)]) // matched, not on the server, no files here (a reload)
  await act(() => result.current.addFiles(drop(1, 2)))
  expect(result.current.notice).toBe("Reconnected 2 of 2 files")
})

it("counts a re-drop of files already attached as already in your list, not a reconnect", async () => {
  const result = await setup([mk(1)])
  await act(() => result.current.addFiles(drop(1))) // reconnects
  await act(() => result.current.addFiles(drop(1))) // dropped again
  expect(result.current.notice).toBe("This file is already in your list")
})

it("stays quiet about duplicates on a silent reconnect", async () => {
  const result = await setup([mk(1, { staged: true })])
  await act(() => result.current.addFiles(drop(1), { silent: true }))
  expect(result.current.notice).toBeNull()
})

it("never claims books are already in the library", async () => {
  const result = await setup([mk(1, { staged: true })])
  await act(() => result.current.addFiles(drop(1)))
  expect(result.current.notice).not.toMatch(/library/i)
})
