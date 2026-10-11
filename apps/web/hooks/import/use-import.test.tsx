// @ts-nocheck
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { pollInterval, useImport } from "./use-import"
import { importApi } from "@/lib/import/api"
import { importFiles } from "@/lib/import/files"
import { ApiError } from "@/types/api"

jest.mock("@/lib/import/api", () => ({ importApi: {} }))
jest.mock("@/lib/query-client", () => ({ forceFreshLibraryOnNextVisit: jest.fn() }))

const summary = (id: number, counts = {}) => ({
  id, created_at: "", expires_at: "", total: 1, counts, skipped: 0, encrypted: 0, ready: 0, auto_picked: 0, staged: 0, unstaged: 0,
})
const wrapper = ({ children }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}
const pick = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ file: new File(["x"], `b${i}.epub`), path: `L/b${i}.epub` }))

beforeEach(() => {
  importFiles.clear() // the store is module-level, so tests must not share it
  Object.assign(importApi, {
    limits: jest.fn().mockResolvedValue({ max_rows_per_call: 500 }),
    listBatches: jest.fn().mockResolvedValue({ batches: [summary(7), summary(3)] }),
    batch: jest.fn().mockImplementation(async (id) => summary(id)),
    rows: jest.fn().mockResolvedValue({ rows: [], next_cursor: null }),
    createBatch: jest.fn().mockResolvedValue(summary(9)),
    putRows: jest.fn().mockResolvedValue({ created: 0, existing: 0 }),
    startMatch: jest.fn().mockResolvedValue({}),
    stageFile: jest.fn().mockResolvedValue({ staged: true }),
    startImport: jest.fn().mockResolvedValue({ id: "j", status: "running", total: 1, done: 0 }),
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

it("starts one server-side import instead of looping over rows", async () => {
  const { result } = renderHook(() => useImport({}), { wrapper })
  await waitFor(() => expect(result.current.summary?.id).toBe(7))
  await act(() => result.current.runImport())
  expect(importApi.startImport).toHaveBeenCalledTimes(1)
  expect(importApi.startImport).toHaveBeenCalledWith(7, {})
  expect(importApi.stageFile).not.toHaveBeenCalled() // nothing in memory to send
})

it("asks the server to retry failed rows", async () => {
  const { result } = renderHook(() => useImport({}), { wrapper })
  await waitFor(() => expect(result.current.summary?.id).toBe(7))
  await act(() => result.current.runImport(true))
  expect(importApi.startImport).toHaveBeenCalledWith(7, { retry_failed: true })
})

describe("reconnecting files after a reload", () => {
  const mk = (id, path, over = {}) => ({ id, path, size: 1, mtime: 1000, state: "matched", decision: "auto", ...over })
  const fileAt = (name, path) => ({ file: new File(["x"], name, { lastModified: 1000 }), path })

  it("attaches by name when a subfolder is dropped, skips new rows for them, and reports the count", async () => {
    // reload: batch 7 exists with two matched rows but no files in memory
    importApi.rows.mockResolvedValue({ rows: [mk(1, "Library/sub/a.epub"), mk(2, "Library/b.epub")], next_cursor: null })
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.batchId).toBe(7))
    await waitFor(() => expect(result.current.missing).toBe(2))

    await act(() => result.current.addFiles([fileAt("a.epub", "sub/a.epub")])) // dropped one level down
    expect(importApi.putRows).not.toHaveBeenCalled() // already has a row: no duplicate
    await waitFor(() => expect(result.current.notice).toBe("Reconnected 1 of 2 files"))
    expect(result.current.missing).toBe(1)
    expect(result.current.hasFile(mk(1, "Library/sub/a.epub"))).toBe(true)
  })

  it("sends new files as rows and re-attaches the known ones in the same drop", async () => {
    importApi.rows.mockResolvedValue({ rows: [mk(1, "Library/a.epub")], next_cursor: null })
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.batchId).toBe(7))
    await act(() => result.current.addFiles([fileAt("a.epub", "a.epub"), fileAt("new.epub", "new.epub")]))
    expect(importApi.putRows).toHaveBeenCalledTimes(1)
    expect(importApi.putRows.mock.calls[0][1].map((r) => r.path)).toEqual(["new.epub"])
  })

  it("keeps the files when saving or matching fails, so the admin can retry", async () => {
    importApi.listBatches.mockResolvedValue({ batches: [] })
    importApi.putRows.mockRejectedValue(new Error("network down"))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.resumed).toBe(true))
    const picked = fileAt("a.epub", "a.epub")
    await act(() => result.current.addFiles([picked]))
    expect(result.current.error).toBe("network down")
    expect(result.current.attachedCount).toBe(1)
    expect(result.current.hasFile({ path: "a.epub", size: 1, mtime: 1000 })).toBe(true)
  })

  it("keeps the files when starting the import fails, and only Start over clears them", async () => {
    importApi.listBatches.mockResolvedValue({ batches: [] })
    importApi.deleteBatch = jest.fn().mockResolvedValue({})
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.resumed).toBe(true))
    await act(() => result.current.addFiles([fileAt("a.epub", "a.epub")]))
    importApi.rows.mockResolvedValue({ rows: [mk(1, "a.epub")], next_cursor: null })
    importApi.startImport.mockRejectedValue(new Error("boom"))
    await act(() => result.current.runImport())
    expect(result.current.error).toBe("boom")
    expect(result.current.attachedCount).toBe(1)
    await act(() => result.current.clearBatch())
    expect(result.current.attachedCount).toBe(0)
  })

  it("warns before leaving while matched books are still waiting to be imported", async () => {
    const add = jest.spyOn(window, "addEventListener")
    importApi.listBatches.mockResolvedValue({ batches: [] })
    importApi.createBatch.mockResolvedValue(summary(9, { matched: 1 }))
    importApi.batch.mockResolvedValue({ ...summary(9, { matched: 1 }), ready: 1, unstaged: 1 })
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.resumed).toBe(true))
    await act(() => result.current.addFiles([fileAt("a.epub", "a.epub")]))
    await waitFor(() => expect(add.mock.calls.some(([t]) => t === "beforeunload")).toBe(true))
    const warn = add.mock.calls.find(([t]) => t === "beforeunload")[1]
    const e = new Event("beforeunload", { cancelable: true })
    warn(e)
    expect(e.defaultPrevented).toBe(true)
    add.mockRestore()
  })
})

describe("match job status", () => {
  const withMatch = (counts, match) => ({ ...summary(7, counts), total: 5, match })
  const job = (status) => ({ id: "j", status, total: 5, done: 1, error: null, retry_after: null })

  it("restarts matching once when rows are queued and no job exists", async () => {
    importApi.batch.mockResolvedValue(withMatch({ queued: 3 }, null))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(importApi.startMatch).toHaveBeenCalledWith(7))
    await act(async () => { await result.current.refresh() })
    await waitFor(() => expect(importApi.batch.mock.calls.length).toBeGreaterThan(1))
    expect(importApi.startMatch).toHaveBeenCalledTimes(1)
  })

  it("restarts when the last job is done but rows are still queued", async () => {
    importApi.batch.mockResolvedValue(withMatch({ queued: 3 }, job("done")))
    renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(importApi.startMatch).toHaveBeenCalledTimes(1))
  })

  it.each(["running", "queued", "failed"])("does not restart over a %s job", async (status) => {
    importApi.batch.mockResolvedValue(withMatch({ queued: 3 }, job(status)))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.summary?.match?.status).toBe(status))
    expect(importApi.startMatch).not.toHaveBeenCalled()
  })

  it("does not restart when nothing is queued", async () => {
    importApi.batch.mockResolvedValue(withMatch({ matched: 5 }, null))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
    expect(importApi.startMatch).not.toHaveBeenCalled()
  })
})

describe("bulk remove", () => {
  it("removes by the current filter and refetches, never sending ids", async () => {
    importApi.action = jest.fn().mockResolvedValue({ updated: 2 })
    const { result } = renderHook(() => useImport({ state: "no_match" }), { wrapper })
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
    await act(() => result.current.bulk("remove"))
    expect(importApi.action).toHaveBeenCalledWith(7, { action: "remove", value: undefined, state: "no_match" })
  })

  it("removes the books skipped earlier", async () => {
    importApi.action = jest.fn().mockResolvedValue({ updated: 3 })
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
    await act(() => result.current.bulk("remove", undefined, { skipped: true }))
    expect(importApi.action).toHaveBeenCalledWith(7, { action: "remove", value: undefined, skipped: true })
  })
})

describe("removing a row", () => {
  it("deletes it on the server and refetches the batch", async () => {
    importApi.removeRow = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
    const before = importApi.batch.mock.calls.length
    await act(() => result.current.removeRow({ id: 42 }))
    expect(importApi.removeRow).toHaveBeenCalledWith(7, 42)
    await waitFor(() => expect(importApi.batch.mock.calls.length).toBeGreaterThan(before))
  })

  it("shows the error and still refetches when the server refuses", async () => {
    importApi.removeRow = jest.fn().mockRejectedValue(new Error("Row is importing"))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
    await act(() => result.current.removeRow({ id: 42 }))
    expect(result.current.error).toBe("Row is importing")
  })
})

describe("pages", () => {
  it("asks the server for 50 rows at the page's offset, and exposes the total", async () => {
    importApi.rows.mockResolvedValue({ rows: [], next_cursor: null, total: 120 })
    const { result } = renderHook(() => useImport({ state: "matched" }, 2), { wrapper })
    await waitFor(() => expect(result.current.total).toBe(120))
    expect(importApi.rows).toHaveBeenCalledWith(7, expect.objectContaining({ state: "matched", offset: 100, limit: 50 }))
  })

  it("leaves total unknown when the server does not send it", async () => {
    importApi.rows.mockResolvedValue({ rows: [], next_cursor: null })
    const { result } = renderHook(() => useImport({}, 0), { wrapper })
    await waitFor(() => expect(importApi.rows).toHaveBeenCalled())
    expect(result.current.total).toBeUndefined()
  })
})

describe("removing several rows", () => {
  const rowsOf = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, path: `L/b${i + 1}.epub`, size: 1, mtime: 1000 }))
  const attach = (rows) => rows.forEach((r) => importFiles.add(new File(["x"], `b${r.id}.epub`, { lastModified: 1000 }), r.path))

  it("removes the picked rows in one call, drops their files, and refetches", async () => {
    importApi.action = jest.fn().mockResolvedValue({ updated: 3 })
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
    const rows = rowsOf(3)
    attach(rows)
    await act(() => result.current.removeRows(rows))
    expect(importApi.action).toHaveBeenCalledTimes(1)
    expect(importApi.action).toHaveBeenCalledWith(7, { action: "remove", row_ids: [1, 2, 3] })
    expect(rows.some((r) => importFiles.has(r))).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("sends at most 500 ids per call and adds up what was removed", async () => {
    importApi.action = jest.fn().mockImplementation(async (_b, body) => ({ updated: body.row_ids.length }))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
    await act(() => result.current.removeRows(rowsOf(1200)))
    expect(importApi.action.mock.calls.map((c) => c[1].row_ids.length)).toEqual([500, 500, 200])
    expect(result.current.error).toBeNull()
  })

  it("reports the difference when the server removed fewer than were sent", async () => {
    importApi.action = jest.fn().mockResolvedValue({ updated: 1 })
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
    await act(() => result.current.removeRows(rowsOf(3)))
    expect(result.current.error).toBe("2 books could not be removed.")
  })

  it("keeps the files and shows the error when the call fails", async () => {
    importApi.action = jest.fn().mockRejectedValue(new Error("down"))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
    const rows = rowsOf(2)
    attach(rows)
    await act(() => result.current.removeRows(rows))
    expect(result.current.error).toBe("down")
    expect(importFiles.has(rows[0])).toBe(true)
  })
})

describe("Start over on an expired list", () => {
  it("still clears the page when the server says the list is gone", async () => {
    importApi.deleteBatch = jest.fn().mockRejectedValue(new ApiError("gone", 410))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
    await act(() => result.current.clearBatch())
    await waitFor(() => expect(result.current.batchId).toBeNull())
  })

  it("surfaces any other failure", async () => {
    importApi.deleteBatch = jest.fn().mockRejectedValue(new ApiError("boom", 500))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
    await expect(act(() => result.current.clearBatch())).rejects.toThrow("boom")
  })
})

describe("import state from the server alone", () => {
  const job = (status, over = {}) => ({ id: "j", status, total: 5, done: 2, imported: 2, duplicate: 0, failed: 0, waiting: 0, ...over })
  const withJob = (j, counts = { matched: 3, imported: 2 }) => ({ ...summary(7, counts), total: 5, import: j })

  it("is importing after a reload while the job runs, with no click on this page", async () => {
    importApi.batch.mockResolvedValue(withJob(job("running")))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.importing).toBe(true))
    expect(result.current.importJob?.done).toBe(2)
    expect(importApi.startImport).not.toHaveBeenCalled()
  })

  it("treats a queued job as importing too", async () => {
    importApi.batch.mockResolvedValue(withJob(job("queued", { done: 0 })))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.importing).toBe(true))
  })

  it("is importing from the row counts when the job is gone (server restart)", async () => {
    importApi.batch.mockResolvedValue(withJob(null, { importing: 3, imported: 2 }))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.importing).toBe(true))
  })

  it.each(["done", "failed"])("is not importing once the job is %s", async (status) => {
    importApi.batch.mockResolvedValue(withJob(job(status), { matched: 3, imported: 2 }))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.importJob?.status).toBe(status))
    expect(result.current.importing).toBe(false)
  })

  it("is importing between pressing the button and the job showing up", async () => {
    let finish
    importApi.startImport.mockImplementation(() => new Promise((ok) => (finish = () => ok(job("running")))))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
    let run
    act(() => { run = result.current.runImport() })
    await waitFor(() => expect(result.current.importing).toBe(true))
    await act(async () => { finish(); await run })
    expect(result.current.importing).toBe(false)
  })

  it("does not warn about leaving while the server runs the import", async () => {
    const add = jest.spyOn(window, "addEventListener")
    importApi.batch.mockResolvedValue(withJob(job("running")))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.importing).toBe(true))
    expect(add.mock.calls.some(([t]) => t === "beforeunload")).toBe(false)
    add.mockRestore()
  })
})

describe("changing a row's edition or encryption", () => {
  const updated = { id: 5, path: "L/a.epub", size: 1, mtime: 1, state: "matched", decision: "user", olid: 99, match_title: "The right book", match_author: "Right Author", staged: true }

  it("puts the server's row into the list at once, before the refetch", async () => {
    importApi.rows.mockResolvedValue({ rows: [{ ...updated, olid: 1, match_title: "The wrong book", decision: "auto" }], next_cursor: null, total: 1 })
    importApi.patchRow = jest.fn().mockResolvedValue(updated)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } }) // one client, so the cache survives re-renders
    const { result } = renderHook(() => useImport({}), { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> })
    await waitFor(() => expect(result.current.rows[0]?.match_title).toBe("The wrong book"))
    importApi.rows.mockImplementation(() => new Promise(() => {})) // the refetch never answers
    await act(() => result.current.patchRow(result.current.rows[0], { olid: 99 }))
    expect(importApi.patchRow).toHaveBeenCalledWith(7, 5, { olid: 99 })
    expect(result.current.rows[0]).toMatchObject({ olid: 99, match_title: "The right book", decision: "user" })
  })

  it("throws a failed edition change for the panel to show, without a page banner behind it", async () => {
    importApi.patchRow = jest.fn().mockRejectedValue(new Error("Open Library is down"))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
    await expect(act(() => result.current.patchRow({ id: 5 }, { olid: 99 }))).rejects.toThrow("Open Library is down")
    expect(result.current.error).toBeNull()
  })

  it("shows a failed encryption change on the page, and does not throw", async () => {
    importApi.patchRow = jest.fn().mockRejectedValue(new Error("nope"))
    const { result } = renderHook(() => useImport({}), { wrapper })
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
    await act(() => result.current.patchRow({ id: 5 }, { encrypted: true }))
    expect(result.current.error).toBe("nope")
  })

  it("forgets the old suggestions for the row once its edition changed", async () => {
    importApi.patchRow = jest.fn().mockResolvedValue(updated)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const spy = jest.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useImport({}), { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> })
    await waitFor(() => expect(result.current.summary?.id).toBe(7))
    await act(() => result.current.patchRow({ id: 5 }, { olid: 99 }))
    expect(spy).toHaveBeenCalledWith({ queryKey: ["import-candidates", 7, 5] })
  })
})
