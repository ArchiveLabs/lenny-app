"use client"

import { useCallback, useState } from "react"
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { preloadApi } from "@/lib/preload/api"
import { toMs } from "@/lib/preload/time"
import { forceFreshLibraryOnNextVisit } from "@/lib/query-client"
import { ImportsResponseSchema, type ImportJob } from "@/types/api"
import type { PreloadImportBody } from "@/types/preload"

export const SOURCE = "standardebooks"
const inFlight = (j: ImportJob) => j.status === "pending" || j.status === "downloading"

export type CatalogSort = "title" | "added_desc"

export function useCatalog(f: { q: string; collection: string; hideOwned: boolean; sort?: CatalogSort; newOnly?: boolean }) {
  return useInfiniteQuery({
    queryKey: ["preload-catalog", f],
    queryFn: ({ pageParam }) =>
      preloadApi.catalog({
        q: f.q.trim(), collection: f.collection, hide_owned: f.hideOwned, sort: f.sort, new_only: f.newOnly, cursor: pageParam, limit: 48,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.next_cursor ?? undefined,
    staleTime: 60_000,
    placeholderData: keepPreviousData, // typing in the search box must not blank the page while the next answer loads
    retry: false, // a 502 means Open Library is down; let the admin retry on purpose
  })
}

/** One book's details. Open Library is asked on the first call (a second or two) and the server caches it for hours. */
export function usePreloadBook(olid: number | null) {
  return useQuery({
    queryKey: ["preload-book", olid],
    queryFn: () => preloadApi.book(olid!),
    enabled: olid !== null,
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useCollections() {
  return useQuery({ queryKey: ["preload-collections"], queryFn: preloadApi.collections, staleTime: 5 * 60_000 })
}

// Allow for a little clock difference between this browser and the server.
const SKEW_MS = 5000

/** Is this job part of the current load? Running jobs always are (covers a reload mid-load); finished ones only if updated since `since`. */
export function inCurrentLoad(j: ImportJob, since: number | null) {
  if (inFlight(j)) return true
  if (since === null || !j.updated_at) return false
  const t = toMs(j.updated_at)
  return Number.isFinite(t) && t >= since - SKEW_MS
}

/**
 * Standard Ebooks loads, polled while any are still running. `since` is when this page started
 * its load (ms); /admin/imports keeps 7 days of rows, so older finished ones are left out.
 * Shares the cache key with the Redeem page.
 */
export function useLoadProgress(since: number | null) {
  const q = useQuery({
    queryKey: ["imports"],
    queryFn: () => fetchAdmin("imports").then((r) => handleApiResponse(r, ImportsResponseSchema)),
    refetchInterval: (query) => (query.state.data?.imports.some((j) => j.source === SOURCE && inFlight(j)) ? 3000 : false),
  })
  const jobs = (q.data?.imports ?? []).filter((j) => j.source === SOURCE && inCurrentLoad(j, since))
  return {
    jobs,
    active: jobs.filter(inFlight).length,
    done: jobs.filter((j) => j.status === "done").length,
    failed: jobs.filter((j) => j.status === "failed"),
  }
}

export function useLoadBooks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PreloadImportBody) => preloadApi.importBooks(body),
    onSuccess: () => {
      forceFreshLibraryOnNextVisit()
      qc.invalidateQueries({ queryKey: ["imports"] })
      qc.invalidateQueries({ queryKey: ["preload-catalog"] })
    },
  })
}

const CHECK_EVERY_MS = 3000
const CHECK_FOR_MS = 60_000
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

/**
 * "Refresh": ask the server to check archive.org now, then reload the catalog every 3 seconds until its rebuild is
 * done (it gives up after 60), and once more. Also waits that way when a rebuild was already running.
 */
export function useCatalogRefresh(refetchCatalog: () => Promise<{ data?: { pages: { refreshing: boolean }[] } }>) {
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const refresh = useCallback(async () => {
    setError(null)
    setChecking(true)
    try {
      await preloadApi.refresh()
      const until = Date.now() + CHECK_FOR_MS
      for (;;) {
        await sleep(CHECK_EVERY_MS)
        const res = await refetchCatalog()
        if (!res.data?.pages[0]?.refreshing) {
          await refetchCatalog()
          break
        }
        if (Date.now() >= until) break
      }
    } catch (e) {
      setError(e)
    } finally {
      setChecking(false)
    }
  }, [refetchCatalog])
  return { checking, error, refresh }
}
