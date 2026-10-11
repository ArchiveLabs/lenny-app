"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchLibraryLinks } from "@/lib/library/links"

/** The sharing links, fetched once and kept for a few minutes. When it fails nothing is shown, so no retry and no noise. */
export function useLibraryLinks() {
  return useQuery({ queryKey: ["library-links"], queryFn: fetchLibraryLinks, staleTime: 5 * 60_000, retry: false })
}
