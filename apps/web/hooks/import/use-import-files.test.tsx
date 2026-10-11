// @ts-nocheck
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useImport } from "./use-import"
import { importApi } from "@/lib/import/api"
import { importFiles } from "@/lib/import/files"
import * as fsa from "@/lib/import/fsa"

jest.mock("@/lib/import/api", () => ({ importApi: {} }))
jest.mock("@/lib/query-client", () => ({ forceFreshLibraryOnNextVisit: jest.fn() }))
jest.mock("@/lib/import/fsa", () => ({
  supportsDirectoryPicker: jest.fn(),
  loadHandle: jest.fn(),
  saveHandle: jest.fn(),
  clearHandle: jest.fn(),
  pickDirectory: jest.fn(),
  ensureReadPermission: jest.fn(),
  hasReadPermission: jest.fn(),
  walkDirectory: jest.fn(),
}))

const mk = (id, path) => ({ id, path, size: 1, mtime: 1000, state: "matched", decision: "auto", skipped: false })
const fileAt = (path) => ({ file: new File(["x"], path.split("/").pop(), { lastModified: 1000 }), path })
const batch = { id: 7, created_at: "", expires_at: "", total: 1, counts: { matched: 1 }, skipped: 0, encrypted: 0, ready: 1, auto_picked: 1 }
// One client for the whole test, like the dashboard: a remount reuses it.
const mount = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return renderHook(() => useImport({}), { wrapper })
}
const settled = () => waitFor(() => expect(importApi.rows).toHaveBeenCalledWith(7, expect.objectContaining({ state: "matched" })))

beforeEach(() => {
  jest.clearAllMocks()
  importFiles.clear()
  Object.assign(importApi, {
    limits: jest.fn().mockResolvedValue({ max_rows_per_call: 500 }),
    listBatches: jest.fn().mockResolvedValue({ batches: [batch] }),
    batch: jest.fn().mockResolvedValue(batch),
    rows: jest.fn().mockResolvedValue({ rows: [mk(1, "L/a.epub")], next_cursor: null }),
    putRows: jest.fn().mockResolvedValue({ created: 0, existing: 0 }),
    startMatch: jest.fn().mockResolvedValue({}),
    removeRow: jest.fn().mockResolvedValue(batch),
    deleteBatch: jest.fn().mockResolvedValue({}),
  })
  fsa.supportsDirectoryPicker.mockReturnValue(false)
  fsa.loadHandle.mockResolvedValue(undefined)
})

it("keeps the attached files when the page unmounts and mounts again", async () => {
  const first = mount()
  await waitFor(() => expect(first.result.current.batchId).toBe(7))
  await act(() => first.result.current.addFiles([fileAt("L/a.epub")]))
  first.unmount()

  importApi.rows.mockClear()
  const second = mount()
  await settled()
  expect(second.result.current.hasFile(mk(1, "L/a.epub"))).toBe(true)
  expect(second.result.current.missing).toBe(0)
  expect(second.result.current.notice).toBeNull()
})

describe("after a real reload with a remembered folder", () => {
  beforeEach(() => {
    fsa.supportsDirectoryPicker.mockReturnValue(true)
    fsa.loadHandle.mockResolvedValue({ name: "L" })
    fsa.walkDirectory.mockResolvedValue([fileAt("L/a.epub")])
  })

  it("reconnects silently when the browser already allows reading", async () => {
    fsa.hasReadPermission.mockResolvedValue(true)
    const { result } = mount()
    await waitFor(() => expect(result.current.notice).toBe("Reconnected 1 of 1 files"))
    expect(fsa.walkDirectory).toHaveBeenCalledTimes(1)
    expect(fsa.ensureReadPermission).not.toHaveBeenCalled() // no prompt, no click
    expect(result.current.missing).toBe(0)
    expect(result.current.reconnecting).toBe(false)
  })

  it("only offers the button when the browser would prompt, and never asks on its own", async () => {
    fsa.hasReadPermission.mockResolvedValue(false)
    const { result } = mount()
    await waitFor(() => expect(result.current.missing).toBe(1))
    await waitFor(() => expect(fsa.hasReadPermission).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.reconnecting).toBe(false))
    expect(fsa.walkDirectory).not.toHaveBeenCalled()
    expect(fsa.ensureReadPermission).not.toHaveBeenCalled()
    expect(result.current.folderName).toBe("L")
  })

  it("tries once per mount, not on every re-render", async () => {
    fsa.hasReadPermission.mockResolvedValue(false)
    const { result, rerender } = mount()
    await waitFor(() => expect(fsa.hasReadPermission).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.reconnecting).toBe(false))
    rerender()
    act(() => { document.dispatchEvent(new Event("visibilitychange")) })
    expect(fsa.hasReadPermission).toHaveBeenCalledTimes(1)
  })
})

it("does nothing on a tab switch or window focus", async () => {
  const { result } = mount()
  await waitFor(() => expect(result.current.batchId).toBe(7))
  await act(() => result.current.addFiles([fileAt("L/a.epub")]))
  const calls = { put: importApi.putRows.mock.calls.length, match: importApi.startMatch.mock.calls.length }
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"))
    window.dispatchEvent(new Event("blur"))
    window.dispatchEvent(new Event("focus"))
  })
  expect(importApi.putRows).toHaveBeenCalledTimes(calls.put)
  expect(importApi.startMatch).toHaveBeenCalledTimes(calls.match)
  expect(result.current.hasFile(mk(1, "L/a.epub"))).toBe(true)
  expect(result.current.missing).toBe(0)
})

it("Start over empties the store", async () => {
  const { result } = mount()
  await waitFor(() => expect(result.current.batchId).toBe(7))
  await act(() => result.current.addFiles([fileAt("L/a.epub")]))
  expect(importFiles.size).toBe(1)
  await act(() => result.current.clearBatch())
  expect(importFiles.size).toBe(0)
})

it("removing a row drops its file from the store", async () => {
  const { result } = mount()
  await waitFor(() => expect(result.current.batchId).toBe(7))
  await act(() => result.current.addFiles([fileAt("L/a.epub")]))
  await act(() => result.current.removeRow(mk(1, "L/a.epub")))
  expect(importApi.removeRow).toHaveBeenCalledWith(7, 1)
  expect(importFiles.has(mk(1, "L/a.epub"))).toBe(false)
})

it("keeps the file when the server refuses the removal", async () => {
  importApi.removeRow.mockRejectedValue(new Error("Row is importing"))
  const { result } = mount()
  await waitFor(() => expect(result.current.batchId).toBe(7))
  await act(() => result.current.addFiles([fileAt("L/a.epub")]))
  await act(() => result.current.removeRow(mk(1, "L/a.epub")))
  expect(importFiles.has(mk(1, "L/a.epub"))).toBe(true)
})
