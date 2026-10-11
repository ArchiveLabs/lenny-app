import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import {
  PreloadBookDetailsSchema, PreloadCatalogSchema, PreloadCollectionsSchema, PreloadImportResultSchema, PreloadRefreshSchema, type PreloadImportBody,
} from "@/types/preload"

export interface CatalogQuery {
  q?: string
  collection?: string
  hide_owned?: boolean
  sort?: "title" | "added_desc"
  new_only?: boolean
  cursor?: string
  limit?: number
}

export const preloadApi = {
  catalog: (f: CatalogQuery) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "" && v !== false) p.set(k, String(v))
    const qs = p.toString()
    return fetchAdmin(`preload/catalog${qs ? `?${qs}` : ""}`).then((r) => handleApiResponse(r, PreloadCatalogSchema))
  },
  /** Checks archive.org now. started is false when a rebuild is already running. */
  refresh: () => fetchAdmin("preload/refresh", { method: "POST" }).then((r) => handleApiResponse(r, PreloadRefreshSchema)),
  book: (olid: number) => fetchAdmin(`preload/books/${olid}`).then((r) => handleApiResponse(r, PreloadBookDetailsSchema)),
  collections: () => fetchAdmin("preload/collections").then((r) => handleApiResponse(r, PreloadCollectionsSchema)),
  importBooks: (body: PreloadImportBody) =>
    fetchAdmin("preload/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => handleApiResponse(r, PreloadImportResultSchema)),
}
