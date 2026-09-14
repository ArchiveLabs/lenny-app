import { QueryClient } from "@tanstack/react-query"
import { LennyBook } from "@/types/api"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // keep unused cache for 10 min
      retry: 1,
    },
  },
})

export const LIBRARY_QUERY_KEY = ["library"] as const

export function invalidateLibraryCache() {
  queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY })
}

// The Library page's queries have refetchOnMount/refetchOnWindowFocus disabled
// (/admin/items is slow, so we don't want a background refetch on every nav there) -
// which means a plain invalidate does nothing useful if the page isn't mounted yet:
// invalidate only refetches *active* queries, and even a stale cached entry won't
// auto-refetch on the next mount with refetchOnMount off. Call this instead right
// before navigating to Library from somewhere that just changed its contents (a
// redeem, an import) so the cache is empty and the next mount is guaranteed fresh.
export function forceFreshLibraryOnNextVisit() {
  queryClient.removeQueries({ queryKey: LIBRARY_QUERY_KEY })
}

// /admin/items can be very slow, so a plain invalidate + background refetch can leave
// just-deleted books visibly on screen for many seconds (keepPreviousData shows the
// stale list until the slow refetch resolves). Strip them from every cached library
// list immediately so the UI reflects the delete right away; the invalidate still runs
// to reconcile pagination/counts once the real refetch comes back.
// Accepts bare OLIDs (as the bulk-delete response returns) or full edition keys.
export function removeBooksFromLibraryCache(olids: (string | number)[]) {
  const digits = new Set(olids.map((id) => String(id).replace(/\D/g, "")))
  queryClient.setQueriesData<LennyBook[]>({ queryKey: LIBRARY_QUERY_KEY }, (old) =>
    old ? old.filter((b) => !digits.has(b.olid.replace(/\D/g, ""))) : old
  )
}
