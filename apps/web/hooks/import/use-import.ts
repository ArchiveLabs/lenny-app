"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { forceFreshLibraryOnNextVisit } from "@/lib/query-client"
import { importApi, type RowFilter } from "@/lib/import/api"
import { FileIndex, splitKnown } from "@/lib/import/files"
import { clearHandle, ensureReadPermission, loadHandle, pickDirectory, saveHandle, supportsDirectoryPicker, walkDirectory } from "@/lib/import/fsa"
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

const UPLOADS_IN_FLIGHT = 3
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

export function useImport(filter: RowFilter) {
  const qc = useQueryClient()
  const [batchId, setBatchId] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  const [error, setError] = useState<string | null>(null)
  // A browser cannot keep File objects across a reload. They live here, found by exact path then by
  // name/size/mtime, and are re-attached by dropping again or by reconnecting a remembered folder.
  // Only clearBatch ever empties this: errors must never lose the files.
  const files = useRef(new FileIndex())
  const cancelled = useRef(false)
  const [missing, setMissing] = useState(0) // matched, unskipped rows with no file attached
  const [notice, setNotice] = useState<string | null>(null)
  const [version, setVersion] = useState(0) // bumps when files are attached, to recount
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
      return busy || phase.kind !== "idle" ? pollInterval(q.state.dataUpdateCount) : false
    },
  })

  const rows = useInfiniteQuery({
    queryKey: ["import-rows", batchId, filter],
    queryFn: ({ pageParam }) => importApi.rows(batchId!, { ...filter, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.next_cursor ?? undefined,
    enabled: batchId !== null,
    staleTime: 0,
  })

  // Keep the list in step with the counts while matching runs.
  const sig = summary.data && JSON.stringify(summary.data.counts)
  useEffect(() => {
    if (sig) qc.invalidateQueries({ queryKey: ["import-rows", batchId] })
  }, [sig, batchId, qc])

  const recount = useCallback(async (id: number) => {
    const ready = await allRows(id, { state: "matched", skipped: false })
    setMissing(ready.filter((r) => !files.current.has(r)).length)
    return ready
  }, [])

  const ready = summary.data?.ready
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
    if (!(importing || (files.current.size > 0 && (ready ?? 0) > 0))) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [importing, ready, version])

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["import-batch", batchId] })
    qc.invalidateQueries({ queryKey: ["import-rows", batchId] })
  }, [qc, batchId])

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
      picked.forEach((p) => files.current.add(p.file, p.path))
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
            const n = ready.filter((r) => files.current.has(r)).length
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
    async (row: ImportRow, body: { skipped?: boolean; olid?: number; encrypted?: boolean }) => {
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

  const bulk = useCallback(
    async (action: "skip" | "unskip" | "set_encrypted", value?: boolean, scope: RowFilter = filter) => {
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

  /** Upload every matched, unskipped row whose file is attached. Returns how many have no file to send. */
  const runImport = useCallback(async () => {
    if (batchId === null) return { missing: 0, failed: 0 }
    cancelled.current = false
    setError(null)
    let ready: ImportRow[]
    try {
      ready = await allRows(batchId, { state: "matched", skipped: false })
    } catch (e) {
      setError(errMsg(e))
      return { missing: 0, failed: 0 }
    }
    const sendable = ready.filter((r) => files.current.has(r))
    let done = 0
    let failed = 0
    setPhase({ kind: "importing", done, total: sendable.length, failed })
    await pool(sendable, UPLOADS_IN_FLIGHT, async (row) => {
      if (cancelled.current) return
      try {
        const res = await importApi.uploadFile(batchId, row.id, files.current.get(row)!)
        if (res.state === "failed" || res.state === "not_epub") failed++
      } catch {
        failed++ // the file stays attached, so Import can simply be pressed again
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
    files.current.clear()
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
    rows: rows.data?.pages.flatMap((p) => p.rows) ?? [],
    rowsLoading: rows.isLoading,
    hasMore: !!rows.hasNextPage,
    loadMore: () => rows.fetchNextPage(),
    resumed: batches.isSuccess,
    loading: batches.isLoading || summary.isLoading,
    phase,
    error,
    addFiles,
    reportError: setError,
    recheck,
    patchRow,
    bulk,
    runImport,
    cancelImport,
    clearBatch,
    attachedCount: files.current.size,
    missing,
    notice,
    folderName,
    folderSupported: supportsDirectoryPicker(),
    chooseFolder,
    reconnectFolder,
    hasFile: (r: ImportRow) => files.current.has(r),
    refresh,
  }
}
