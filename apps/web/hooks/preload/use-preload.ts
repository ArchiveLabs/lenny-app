"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { preloadApi } from "@/lib/preload/api"
import { forceFreshLibraryOnNextVisit } from "@/lib/query-client"
import { ImportsResponseSchema, type ImportJob } from "@/types/api"
import type { PreloadImportBody } from "@/types/preload"

export const SOURCE = "standardebooks"
const inFlight = (j: ImportJob) => j.status === "pending" || j.status === "downloading"

export function useCatalog(f: { q: string; collection: string; hideOwned: boolean }) {
  return useInfiniteQuery({
    queryKey: ["preload-catalog", f],
    queryFn: ({ pageParam }) =>
      preloadApi.catalog({ q: f.q.trim(), collection: f.collection, hide_owned: f.hideOwned, cursor: pageParam, limit: 48 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.next_cursor ?? undefined,
    staleTime: 60_000,
    retry: false, // a 502 means Open Library is down; let the admin retry on purpose
  })
}

export function useCollections() {
  return useQuery({ queryKey: ["preload-collections"], queryFn: preloadApi.collections, staleTime: 5 * 60_000 })
}

/** Standard Ebooks loads, polled while any are still running. Shares the cache key with the Redeem page. */
export function useLoadProgress() {
  const q = useQuery({
    queryKey: ["imports"],
    queryFn: () => fetchAdmin("imports").then((r) => handleApiResponse(r, ImportsResponseSchema)),
    refetchInterval: (query) => (query.state.data?.imports.some((j) => j.source === SOURCE && inFlight(j)) ? 3000 : false),
  })
  const jobs = (q.data?.imports ?? []).filter((j) => j.source === SOURCE)
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
