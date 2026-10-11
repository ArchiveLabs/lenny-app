// @ts-nocheck
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useImport } from "./use-import"
import { importApi } from "@/lib/import/api"
import { importFiles } from "@/lib/import/files"

jest.mock("@/lib/import/api", () => ({ importApi: {} }))
jest.mock("@/lib/query-client", () => ({ forceFreshLibraryOnNextVisit: jest.fn() }))

const batch = { id: 7, created_at: "", expires_at: "", total: 1, counts: {}, skipped: 0, encrypted: 0, ready: 0, auto_picked: 0, staged: 0, unstaged: 0 }
const mount = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderHook(() => useImport({}), { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> })
}
const synced = (over = {}) => ({ reverted: 0, released: 0, removed_from_library: 0, ...over })

beforeEach(() => {
  jest.clearAllMocks()
  importFiles.clear()
  Object.assign(importApi, {
    limits: jest.fn().mockResolvedValue({ max_rows_per_call: 500 }),
    listBatches: jest.fn().mockResolvedValue({ batches: [batch] }),
    batch: jest.fn().mockResolvedValue(batch),
    rows: jest.fn().mockResolvedValue({ rows: [], next_cursor: null }),
    sync: jest.fn().mockResolvedValue(synced()),
    putRows: jest.fn().mockImplementation(async (_i, rows) => ({ created: rows.length, existing: 0, existing_states: {} })),
    startMatch: jest.fn().mockResolvedValue({}),
  })
})

describe("syncing the list with the library", () => {
  it("syncs once when a batch opens", async () => {
    mount()
    await waitFor(() => expect(importApi.sync).toHaveBeenCalledWith(7))
    expect(importApi.sync).toHaveBeenCalledTimes(1)
  })

  it("reads the lists only after the first sync, so they never show stale rows", async () => {
    let release
    importApi.sync.mockImplementation(() => new Promise((ok) => (release = () => ok(synced({ reverted: 2 })))))
    const { result } = mount()
    await waitFor(() => expect(importApi.sync).toHaveBeenCalled())
    await new Promise((ok) => setTimeout(ok, 20))
    expect(importApi.batch).not.toHaveBeenCalled()
    expect(importApi.rows).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true) // no flash of the empty drop zone meanwhile
    await act(async () => release())
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
    expect(importApi.sync.mock.invocationCallOrder[0]).toBeLessThan(importApi.batch.mock.invocationCallOrder[0])
  })

  it("still shows the list when the sync fails", async () => {
    importApi.sync.mockRejectedValue(new Error("down"))
    const { result } = mount()
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
  })

  describe("a later sync (window focus)", () => {
    beforeEach(() => {
      let now = 1_000_000
      jest.spyOn(Date, "now").mockImplementation(() => (now += 40_000))
    })
    afterEach(() => jest.restoreAllMocks())

    it.each([["reverted", { reverted: 2 }], ["released", { released: 1 }], ["removed_from_library", { removed_from_library: 3 }]])(
      "reloads the lists when it changed something (%s)",
      async (_n, over) => {
        const { result } = mount()
        await waitFor(() => expect(result.current.summary?.id).toBe(7))
        importApi.sync.mockResolvedValue(synced(over))
        const before = importApi.batch.mock.calls.length
        act(() => { window.dispatchEvent(new Event("focus")) })
        await waitFor(() => expect(importApi.batch.mock.calls.length).toBeGreaterThan(before))
      },
    )

    it("does not reload when nothing changed", async () => {
      const { result } = mount()
      await waitFor(() => expect(result.current.summary?.id).toBe(7))
      const before = importApi.batch.mock.calls.length
      act(() => { window.dispatchEvent(new Event("focus")) })
      await waitFor(() => expect(importApi.sync).toHaveBeenCalledTimes(2))
      await new Promise((ok) => setTimeout(ok, 30))
      expect(importApi.batch.mock.calls.length).toBe(before)
    })
  })

  it("ignores a failing sync", async () => {
    importApi.sync.mockRejectedValue(new Error("down"))
    const { result } = mount()
    await waitFor(() => expect(importApi.sync).toHaveBeenCalled())
    expect(result.current.error).toBeNull()
  })

  describe("on window focus", () => {
    let now
    beforeEach(() => {
      now = 1_000_000
      jest.spyOn(Date, "now").mockImplementation(() => now)
    })
    afterEach(() => jest.restoreAllMocks())

    it("syncs again, but not more than once in 30 seconds", async () => {
      mount()
      await waitFor(() => expect(importApi.sync).toHaveBeenCalledTimes(1))
      now += 10_000
      act(() => { window.dispatchEvent(new Event("focus")) })
      expect(importApi.sync).toHaveBeenCalledTimes(1)
      now += 25_000 // 35 s since the last sync
      act(() => { window.dispatchEvent(new Event("focus")) })
      await waitFor(() => expect(importApi.sync).toHaveBeenCalledTimes(2))
      now += 5_000
      act(() => { window.dispatchEvent(new Event("focus")) })
      expect(importApi.sync).toHaveBeenCalledTimes(2)
    })

    it("stops listening when the page goes away", async () => {
      const { unmount } = mount()
      await waitFor(() => expect(importApi.sync).toHaveBeenCalledTimes(1))
      unmount()
      now += 60_000
      act(() => { window.dispatchEvent(new Event("focus")) })
      expect(importApi.sync).toHaveBeenCalledTimes(1)
    })
  })
})

describe("dropping files again", () => {
  const file = { file: new File(["x"], "b1.epub", { lastModified: 1000 }), path: "L/b1.epub" }

  it("syncs before looking at the list, so a stale duplicate row cannot swallow the file", async () => {
    const { result } = mount()
    await waitFor(() => expect(result.current.batchId).toBe(7))
    importApi.sync.mockClear()
    importApi.rows.mockClear()
    await act(() => result.current.addFiles([file]))
    expect(importApi.sync.mock.invocationCallOrder[0]).toBeLessThan(importApi.rows.mock.invocationCallOrder[0])
  })

  it("loads a file whose old duplicate row was reverted by the sync, as a normal row", async () => {
    // the sync reverted the duplicate to matched, so the list now has a matched row for it
    importApi.rows.mockResolvedValue({ rows: [{ id: 1, path: "L/b1.epub", size: 1, mtime: 1000, state: "matched", staged: false }], next_cursor: null })
    const { result } = mount()
    await waitFor(() => expect(result.current.batchId).toBe(7))
    await act(() => result.current.addFiles([file]))
    expect(result.current.error).toBeNull()
    expect(result.current.notice).toBe("Reconnected 1 of 1 files")
  })

  it("says Nothing new to load rather than staying silent", async () => {
    importApi.putRows.mockResolvedValue({ created: 0, existing: 0, existing_states: {} })
    const { result } = mount()
    await waitFor(() => expect(result.current.batchId).toBe(7))
    await act(() => result.current.addFiles([file]))
    expect(result.current.notice).toBe("Nothing new to load")
  })

  it("does not say it when something new was loaded", async () => {
    const { result } = mount()
    await waitFor(() => expect(result.current.batchId).toBe(7))
    await act(() => result.current.addFiles([file]))
    expect(result.current.notice).toBeNull()
  })

  it("stays quiet on the silent folder reconnect", async () => {
    importApi.putRows.mockResolvedValue({ created: 0, existing: 0, existing_states: {} })
    const { result } = mount()
    await waitFor(() => expect(result.current.batchId).toBe(7))
    await act(() => result.current.addFiles([file], { silent: true }))
    expect(result.current.notice).toBeNull()
  })
})
