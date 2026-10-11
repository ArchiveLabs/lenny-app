"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { forceFreshLibraryOnNextVisit } from "@/lib/query-client"
import { importApi, type RowFilter } from "@/lib/import/api"
import { importFiles, splitKnown } from "@/lib/import/files"
import { clearHandle, ensureReadPermission, hasReadPermission, loadHandle, pickDirectory, saveHandle, supportsDirectoryPicker, walkDirectory } from "@/lib/import/fsa"
import { chunk, ingest, pool } from "@/lib/import/ingest"
import type { PickedFile } from "@/lib/import/walk"
import type { ImportRow } from "@/types/import"

export type Phase =
  | { kind: "idle" }
  | { kind: "reading"; done: number; total: number }
  | { kind: "saving"; done: number; total: number }
  | { kind: "importing"; done: number; total: number; failed: number }

// Poll fast at first, then back off; react-query pauses polling while the tab is hidden.
export const pollInterval = (updates: number) => (updates < 30 ? 2000 : updates < 90 ? 5000 : 10000)

export const PAGE_SIZE = 50

const UPLOADS_IN_FLIGHT = 3
const MAX_ROW_IDS = 500 // the server takes 1-500 ids per remove
const RETRIES = 2

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let n = 1; ; n++) {
    try {
      return await fn()
    } catch (e) {
      if (n > RETRIES) throw e
      await new Promise((ok) => setTimeout(ok, 300 * n))
    }
  }
}
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong")

async function allRows(batchId: number, filter: RowFilter): Promise<ImportRow[]> {
  const out: ImportRow[] = []
  let cursor: string | undefined
  do {
    const page = await importApi.rows(batchId, { ...filter, cursor, limit: 200 })
    out.push(...page.rows)
    cursor = page.next_cursor ?? undefined
  } while (cursor)
  return out
}

export function useImportLimits() {
  return useQuery({ queryKey: ["import-limits"], queryFn: importApi.limits, staleTime: 10 * 60 * 1000 })
}

export function useImport(filter: RowFilter, page = 0) {
  const qc = useQueryClient()
  const [batchId, setBatchId] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  const [error, setError] = useState<string | null>(null)
  // A browser cannot keep File objects across a reload, so after one they are re-attached by dropping
  // again or by reconnecting the remembered folder. Between routes they stay in the module-level
  // importFiles. Only clearBatch and removeRow shrink it: errors must never lose the files.
  const cancelled = useRef(false)
  const [missing, setMissing] = useState(0) // matched, unskipped rows with no file attached
  const [notice, setNotice] = useState<string | null>(null)
  const [version, setVersion] = useState(0) // bumps when files are attached, to recount
  const [uploading, setUploading] = useState(false) // staging files in the background
  const [uploadFailed, setUploadFailed] = useState(0)
  const [reconnecting, setReconnecting] = useState(false) // silent reconnect in progress
  const [folderName, setFolderName] = useState<string | null>(null) // remembered folder (Chromium)

  useEffect(() => {
    if (!supportsDirectoryPicker()) return
    loadHandle().then((h) => setFolderName(h?.name ?? null))
  }, [])

  // Resume: reopen the newest unexpired batch.
  const batches = useQuery({ queryKey: ["import-batches"], queryFn: importApi.listBatches, staleTime: Infinity })
  useEffect(() => {
    if (batchId === null && batches.data?.batches[0]) setBatchId(batches.data.batches[0].id)
  }, [batches.data, batchId])

  const summary = useQuery({
    queryKey: ["import-batch", batchId],
    queryFn: () => importApi.batch(batchId!),
    enabled: batchId !== null,
    staleTime: 0,
    refetchInterval: (q) => {
      const c = q.state.data?.counts
      // A failed match leaves rows queued but nothing is running: stop polling until the admin retries.
      const matching = (c?.queued ?? 0) > 0 && q.state.data?.match?.status !== "failed"
      const busy = !!c && (matching || (c.importing ?? 0) > 0)
      return busy || uploading || phase.kind !== "idle" ? pollInterval(q.state.dataUpdateCount) : false
    },
  })

  const rows = useQuery({
    queryKey: ["import-rows", batchId, filter, page],
    queryFn: () => importApi.rows(batchId!, { ...filter, offset: page * PAGE_SIZE, limit: PAGE_SIZE }),
    enabled: batchId !== null,
    staleTime: 0,
    placeholderData: keepPreviousData, // no blank list while the next page loads
  })

  // Keep the list in step with the counts while matching runs.
  const sig = summary.data && JSON.stringify([summary.data.counts, summary.data.staged])
  useEffect(() => {
    if (sig) qc.invalidateQueries({ queryKey: ["import-rows", batchId] })
  }, [sig, batchId, qc])

  const recount = useCallback(async (id: number) => {
    const ready = await allRows(id, { state: "matched", skipped: false })
    setMissing(ready.filter((r) => !r.staged && !importFiles.has(r)).length)
    return ready
  }, [])

  const ready = summary.data?.ready
  const unstaged = summary.data?.unstaged ?? 0
  const matchStatus = summary.data?.match?.status
  const queuedRows = summary.data?.counts.queued ?? 0
  const matching = queuedRows > 0 && matchStatus !== "failed"

  const idle = phase.kind === "idle"
  useEffect(() => {
    if (batchId === null || ready === undefined || matching || !idle) return
    recount(batchId).catch(() => {}) // a banner is a hint; a failed count must not raise an error
  }, [batchId, ready, matching, idle, version, recount])

  // Leaving now would lose the attached files (and stop a running import).
  const importing = phase.kind === "importing"
  useEffect(() => {
    if (!(importing || uploading || (importFiles.size > 0 && unstaged > 0))) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [importing, uploading, unstaged, version])

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["import-batch", batchId] })
    qc.invalidateQueries({ queryKey: ["import-rows", batchId] })
  }, [qc, batchId])

  // Send each matched, unskipped row's file to the server in the background, so a reload or a killed tab
  // loses nothing. One pass at a time; a change during a pass schedules another. Rows that still fail after
  // retries are left alone until the admin retries (gaveUp), so a bad file cannot loop.
  const staging = useRef(false)
  const again = useRef(false)
  const gaveUp = useRef(new Set<number>())
  const stage = useCallback(async () => {
    if (batchId === null) return
    if (staging.current) {
      again.current = true
      return
    }
    staging.current = true
    setUploading(true)
    try {
      do {
        again.current = false
        const todo = (await allRows(batchId, { state: "matched", staged: false })).filter(
          (r) => importFiles.has(r) && !gaveUp.current.has(r.id),
        )
        await pool(todo, UPLOADS_IN_FLIGHT, async (row) => {
          try {
            await withRetry(() => importApi.stageFile(batchId, row.id, importFiles.get(row)!))
            gaveUp.current.delete(row.id)
          } catch {
            gaveUp.current.add(row.id)
          }
        })
      } while (again.current)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      staging.current = false
      setUploadFailed(gaveUp.current.size)
      setUploading(false)
      refresh()
    }
  }, [batchId, refresh])

  const retryUploads = useCallback(() => {
    gaveUp.current.clear()
    setUploadFailed(0)
    stage()
  }, [stage])

  useEffect(() => {
    if (batchId === null || unstaged === 0 || importFiles.size === 0 || phase.kind === "importing") return
    stage()
  }, [batchId, unstaged, sig, version, phase.kind, stage])

  // Queued rows with no live job mean the server restarted and lost it: start it again, once per page load.
  const restarted = useRef(false)
  useEffect(() => {
    if (batchId === null || restarted.current || queuedRows === 0 || (matchStatus && matchStatus !== "done")) return
    restarted.current = true
    importApi.startMatch(batchId).then(refresh, () => {}) // the failure shows up as match.failed on the next poll
  }, [batchId, queuedRows, matchStatus, refresh])
  const addFiles = useCallback(
    async (picked: PickedFile[]) => {
      if (!picked.length) return
      setError(null)
      setNotice(null)
      // Attach first: whatever goes wrong below, the files stay.
      picked.forEach((p) => importFiles.add(p.file, p.path))
      setVersion((v) => v + 1)
      try {
        const limit = (await qc.ensureQueryData({ queryKey: ["import-limits"], queryFn: importApi.limits })).max_rows_per_call
        // Files that already have a row (same or different folder level) only need re-attaching, not a new row.
        const existing = batchId !== null ? await allRows(batchId, {}) : []
        const { fresh } = splitKnown(picked, existing)
        if (fresh.length) {
          setPhase({ kind: "reading", done: 0, total: fresh.length })
          const newRows = await ingest(fresh, (done, total) => setPhase({ kind: "reading", done, total }))
          const id = batchId ?? (await importApi.createBatch()).id
          setBatchId(id)
          for (const [i, g] of chunk(newRows, limit).entries()) {
            setPhase({ kind: "saving", done: i * limit, total: newRows.length })
            await importApi.putRows(id, g)
          }
          await importApi.startMatch(id)
          qc.invalidateQueries({ queryKey: ["import-batches"] })
        }
        if (batchId !== null && existing.length) {
          const ready = await recount(batchId)
          if (ready.length) {
            const n = ready.filter((r) => importFiles.has(r)).length
            setNotice(`Reconnected ${n} of ${ready.length} files`)
          }
        }
      } catch (e) {
        setError(errMsg(e))
      } finally {
        setPhase({ kind: "idle" })
        refresh()
      }
    },
    [batchId, qc, refresh, recount],
  )

  /** Chromium: pick a folder with the directory picker and remember it for a one-click reconnect after a reload. */
  const chooseFolder = useCallback(async () => {
    try {
      const h = await pickDirectory()
      if (!h) return
      if (await saveHandle(h)) setFolderName(h.name)
      await addFiles(await walkDirectory(h))
    } catch (e) {
      setError(`Could not read the folder: ${errMsg(e)}`)
    }
  }, [addFiles])

  // After a reload the remembered folder may already be readable: reconnect without a click. If the browser
  // wants a prompt, the Reconnect folder button stays. Once per mount, never a loop.
  const triedSilent = useRef(false)
  useEffect(() => {
    if (triedSilent.current || !folderName || batchId === null || missing === 0 || phase.kind !== "idle") return
    triedSilent.current = true
    setReconnecting(true)
    loadHandle()
      .then(async (h) => {
        if (h && (await hasReadPermission(h))) await addFiles(await walkDirectory(h))
      })
      .catch(() => {}) // folder moved or unreadable: the banner offers the manual route
      .finally(() => setReconnecting(false))
  }, [folderName, batchId, missing, phase.kind, addFiles])

  const reconnectFolder = useCallback(async () => {
    try {
      const h = await loadHandle()
      if (!h) return setFolderName(null)
      if (!(await ensureReadPermission(h))) return setError("Folder access was not allowed. Choose the folder again.")
      await addFiles(await walkDirectory(h))
    } catch (e) {
      setError(`Could not reconnect the folder: ${errMsg(e)}`)
    }
  }, [addFiles])

  const recheck = useCallback(
    async (state: "no_match" | "queued" = "no_match") => {
      if (batchId === null) return
      try {
        await importApi.startMatch(batchId, { state })
      } catch (e) {
        setError(errMsg(e))
      }
      refresh()
    },
    [batchId, refresh],
  )

  const patchRow = useCallback(
    async (row: ImportRow, body: { olid?: number; encrypted?: boolean }) => {
      if (batchId === null) return
      try {
        await importApi.patchRow(batchId, row.id, body)
      } catch (e) {
        setError(errMsg(e))
        throw e
      } finally {
        refresh()
      }
    },
    [batchId, refresh],
  )

  const removeRow = useCallback(
    async (row: ImportRow) => {
      if (batchId === null) return
      try {
        await importApi.removeRow(batchId, row.id)
        importFiles.remove(row)
        setVersion((v) => v + 1)
      } catch (e) {
        setError(errMsg(e))
      } finally {
        refresh()
      }
    },
    [batchId, refresh],
  )

  /** Remove the picked rows in one call per 500. The server skips rows that are importing and says how many it removed. */
  const removeRows = useCallback(
    async (picked: ImportRow[]) => {
      if (batchId === null || !picked.length) return
      let removed = 0
      try {
        for (const g of chunk(picked, MAX_ROW_IDS)) {
          removed += (await importApi.action(batchId, { action: "remove", row_ids: g.map((r) => r.id) })).updated
        }
        const failed = picked.length - removed
        if (failed > 0) setError(failed === 1 ? "1 book could not be removed." : `${failed} books could not be removed.`)
      } catch (e) {
        setError(errMsg(e))
      }
      // Which rows survived a partial removal is unknown; a file nobody references is harmless, so drop them all.
      if (removed > 0) picked.forEach((r) => importFiles.remove(r))
      setVersion((v) => v + 1)
      refresh()
    },
    [batchId, refresh],
  )

  const bulk = useCallback(
    async (action: "set_encrypted" | "remove", value?: boolean, scope: RowFilter = filter) => {
      if (batchId === null) return
      try {
        await importApi.action(batchId, { action, value, ...scope })
      } catch (e) {
        setError(errMsg(e))
      }
      refresh()
    },
    [batchId, filter, refresh],
  )

  /** Import every matched, unskipped row on the server. A row not staged yet is uploaded first. Returns how many have no file anywhere. */
  const runImport = useCallback(async () => {
    if (batchId === null) return { missing: 0, failed: 0 }
    cancelled.current = false
    setError(null)
    let ready: ImportRow[]
    try {
      // skipped: false only guards books skipped before Skip was removed; the server still honours the flag.
      ready = await allRows(batchId, { state: "matched", skipped: false })
    } catch (e) {
      setError(errMsg(e))
      return { missing: 0, failed: 0 }
    }
    const sendable = ready.filter((r) => r.staged || importFiles.has(r))
    let done = 0
    let failed = 0
    setPhase({ kind: "importing", done, total: sendable.length, failed })
    await pool(sendable, UPLOADS_IN_FLIGHT, async (row) => {
      if (cancelled.current) return
      try {
        if (!row.staged) await importApi.stageFile(batchId, row.id, importFiles.get(row)!)
        const res = await importApi.importRow(batchId, row.id)
        if (res.state === "failed" || res.state === "not_epub") failed++
      } catch {
        failed++ // staged or still attached, so Import can simply be pressed again
      }
      setPhase({ kind: "importing", done: ++done, total: sendable.length, failed })
    })
    setPhase({ kind: "idle" })
    forceFreshLibraryOnNextVisit()
    refresh()
    return { missing: ready.length - sendable.length, failed }
  }, [batchId, refresh])

  const cancelImport = useCallback(() => {
    cancelled.current = true
  }, [])

  const clearBatch = useCallback(async () => {
    if (batchId === null) return
    await importApi.deleteBatch(batchId)
    importFiles.clear()
    clearHandle()
    setFolderName(null)
    setMissing(0)
    setNotice(null)
    setBatchId(null)
    qc.setQueryData(["import-batches"], { batches: [] })
  }, [batchId, qc])

  return {
    batchId,
    summary: summary.data,
    rows: rows.data?.rows ?? [],
    total: rows.data?.total ?? undefined,
    rowsLoading: rows.isLoading,
    resumed: batches.isSuccess,
    loading: batches.isLoading || summary.isLoading,
    phase,
    error,
    addFiles,
    reportError: setError,
    recheck,
    patchRow,
    bulk,
    removeRow,
    removeRows,
    runImport,
    cancelImport,
    clearBatch,
    reconnecting,
    uploading,
    uploadFailed,
    retryUploads,
    attachedCount: importFiles.size,
    missing,
    notice,
    folderName,
    folderSupported: supportsDirectoryPicker(),
    chooseFolder,
    reconnectFolder,
    hasFile: (r: ImportRow) => importFiles.has(r),
    refresh,
  }
}
