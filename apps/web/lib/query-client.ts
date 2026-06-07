import { QueryClient } from "@tanstack/react-query"

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
