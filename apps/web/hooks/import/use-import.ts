"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { forceFreshLibraryOnNextVisit } from "@/lib/query-client"
import { importApi, type RowFilter } from "@/lib/import/api"
import { chunk, ingest, pool, rowKey } from "@/lib/import/ingest"
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

export function useImportLimits() {
  return useQuery({ queryKey: ["import-limits"], queryFn: importApi.limits, staleTime: 10 * 60 * 1000 })
}

export function useImport(filter: RowFilter) {
  const qc = useQueryClient()
  const [batchId, setBatchId] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  const [error, setError] = useState<string | null>(null)
  // Files stay in memory by path|size|mtime; after a reload they are re-attached by dropping the folder again.
  const files = useRef(new Map<string, File>())
  const cancelled = useRef(false)

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
      const busy = !!c && ((c.queued ?? 0) > 0 || (c.importing ?? 0) > 0)
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

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["import-batch", batchId] })
    qc.invalidateQueries({ queryKey: ["import-rows", batchId] })
  }, [qc, batchId])

  const addFiles = useCallback(
    async (picked: PickedFile[]) => {
      if (!picked.length) return
      setError(null)
      try {
        const limit = (await qc.ensureQueryData({ queryKey: ["import-limits"], queryFn: importApi.limits }))
          .max_rows_per_call
        setPhase({ kind: "reading", done: 0, total: picked.length })
        const { rows: newRows, files: found } = await ingest(picked, (done, total) =>
          setPhase({ kind: "reading", done, total }),
        )
        found.forEach((f, k) => files.current.set(k, f))
        const id = batchId ?? (await importApi.createBatch()).id
        setBatchId(id)
        const groups = chunk(newRows, limit)
        for (const [i, g] of groups.entries()) {
          setPhase({ kind: "saving", done: i * limit, total: newRows.length })
          await importApi.putRows(id, g)
        }
        await importApi.startMatch(id)
        qc.invalidateQueries({ queryKey: ["import-batches"] })
      } catch (e) {
        setError(errMsg(e))
      } finally {
        setPhase({ kind: "idle" })
        refresh()
      }
    },
    [batchId, qc, refresh],
  )

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

  /** Upload every matched, unskipped row whose file is in memory. Returns how many have no file to send. */
  const runImport = useCallback(async () => {
    if (batchId === null) return { missing: 0 }
    cancelled.current = false
    setError(null)
    const ready: ImportRow[] = []
    let cursor: string | undefined
    do {
      const page = await importApi.rows(batchId, { state: "matched", skipped: false, cursor, limit: 200 })
      ready.push(...page.rows)
      cursor = page.next_cursor ?? undefined
    } while (cursor)
    const sendable = ready.filter((r) => files.current.has(rowKey(r)))
    let done = 0
    let failed = 0
    setPhase({ kind: "importing", done, total: sendable.length, failed })
    await pool(sendable, UPLOADS_IN_FLIGHT, async (row) => {
      if (cancelled.current) return
      try {
        const res = await importApi.uploadFile(batchId, row.id, files.current.get(rowKey(row))!)
        if (res.state === "failed" || res.state === "not_epub") failed++
      } catch {
        failed++
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
    recheck,
    patchRow,
    bulk,
    runImport,
    cancelImport,
    clearBatch,
    attachedCount: files.current.size,
    hasFile: (r: ImportRow) => files.current.has(rowKey(r)),
    refresh,
  }
}
